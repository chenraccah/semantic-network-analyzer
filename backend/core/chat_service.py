"""
Chat service for discussing analysis results with GPT.
Optimized for cost efficiency.
"""

from typing import List, Dict, Any, Optional
from openai import OpenAI
from .config import settings


class ChatService:
    """Handles chat interactions with GPT about analysis data."""

    def __init__(self):
        self.client = None
        if settings.OPENAI_API_KEY:
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def is_available(self) -> bool:
        """Check if chat service is configured."""
        return self.client is not None and bool(settings.OPENAI_API_KEY)

    def prepare_context(
        self,
        analysis_data: List[Dict],
        stats: Dict,
        group_names: List[str],
        group_keys: List[str],
        max_words: int = 30
    ) -> str:
        """
        Prepare a cost-efficient context from analysis data.
        Only includes essential information to minimize tokens.

        Args:
            analysis_data: Full analysis data
            stats: Statistics dict
            group_names: List of group names
            group_keys: List of group keys
            max_words: Maximum number of top words to include

        Returns:
            Condensed context string
        """
        num_groups = len(group_names)

        # Start with summary stats
        context_parts = [
            "=== SEMANTIC NETWORK ANALYSIS SUMMARY ===",
            f"Groups: {', '.join(group_names)}",
            f"Total unique words: {stats.get('total_words', 0)}",
            f"Total edges (connections): {stats.get('total_edges', 0)}",
        ]

        # Add per-group stats
        for name, key in zip(group_names, group_keys):
            total = stats.get(f'{key}_total', 0)
            clusters = stats.get(f'{key}_clusters', 0)
            context_parts.append(f"{name}: {total} words, {clusters} clusters")

        if num_groups > 1:
            shared = stats.get('words_in_all', stats.get('words_in_both', 0))
            context_parts.append(f"Words in all groups: {shared}")

        # Add top words (sorted by avg_normalized)
        context_parts.append(f"\n=== TOP {max_words} WORDS ===")

        # Sort by average normalized and take top N
        sorted_data = sorted(
            analysis_data,
            key=lambda x: x.get('avg_normalized', 0),
            reverse=True
        )[:max_words]

        for item in sorted_data:
            word = item.get('word', '')
            avg = item.get('avg_normalized', 0)

            # Build per-group info
            group_info = []
            for name, key in zip(group_names, group_keys):
                count = item.get(f'{key}_count', 0)
                norm = item.get(f'{key}_normalized', 0)
                group_info.append(f"{name}:{count}({norm}%)")

            # Add difference for 2 groups
            diff_str = ""
            if num_groups == 2:
                diff = item.get('difference', 0)
                if diff > 10:
                    diff_str = f" [{group_names[0]}-leaning]"
                elif diff < -10:
                    diff_str = f" [{group_names[1]}-leaning]"
                else:
                    diff_str = " [balanced]"

            context_parts.append(
                f"- {word}: avg={avg}%, {', '.join(group_info)}{diff_str}"
            )

        # Add key patterns
        context_parts.append("\n=== KEY PATTERNS ===")

        if num_groups == 2:
            # Find words strongly associated with each group
            group_a_words = [
                d['word'] for d in sorted_data
                if d.get('difference', 0) > 20
            ][:5]
            group_b_words = [
                d['word'] for d in sorted_data
                if d.get('difference', 0) < -20
            ][:5]

            if group_a_words:
                context_parts.append(
                    f"{group_names[0]}-emphasized words: {', '.join(group_a_words)}"
                )
            if group_b_words:
                context_parts.append(
                    f"{group_names[1]}-emphasized words: {', '.join(group_b_words)}"
                )

        # Find most connected words (highest betweenness)
        for name, key in zip(group_names, group_keys):
            high_betweenness = sorted(
                [d for d in sorted_data if d.get(f'{key}_betweenness', 0) > 0.05],
                key=lambda x: x.get(f'{key}_betweenness', 0),
                reverse=True
            )[:3]
            if high_betweenness:
                words = [d['word'] for d in high_betweenness]
                context_parts.append(f"{name} bridge words: {', '.join(words)}")

        return "\n".join(context_parts)

    def chat(
        self,
        message: str,
        context: str,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Send a message to GPT with analysis context.

        Args:
            message: User's message
            context: Prepared analysis context
            conversation_history: Previous messages in conversation

        Returns:
            Dict with response and updated history
        """
        if not self.is_available():
            return {
                "error": "Chat service not configured. Set OPENAI_API_KEY in .env",
                "response": None,
                "history": conversation_history or []
            }

        # Build messages array
        messages = [
            {
                "role": "system",
                "content": f"""You are an expert in semantic network analysis and text analysis.
You're helping analyze comparison data between groups based on word frequencies and network metrics.

Be concise and insightful. Focus on:
- Patterns and differences between groups
- Key themes and concepts
- Actionable insights

Here is the analysis data:

{context}

Answer questions about this data. Be specific and reference actual words/numbers from the data."""
            }
        ]

        # Add conversation history (limit to last 6 exchanges for cost)
        if conversation_history:
            # Keep only recent history to limit tokens
            recent_history = conversation_history[-12:]  # 6 exchanges
            messages.extend(recent_history)

        # Add current message
        messages.append({"role": "user", "content": message})

        try:
            response = self.client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                max_tokens=settings.OPENAI_MAX_TOKENS,
                temperature=settings.OPENAI_TEMPERATURE
            )

            assistant_message = response.choices[0].message.content

            # Update history
            new_history = (conversation_history or []) + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": assistant_message}
            ]

            return {
                "response": assistant_message,
                "history": new_history,
                "tokens_used": response.usage.total_tokens if response.usage else 0
            }

        except Exception as e:
            return {
                "error": str(e),
                "response": None,
                "history": conversation_history or []
            }


# Singleton instance
_chat_service = None


def get_chat_service() -> ChatService:
    """Get or create chat service instance."""
    global _chat_service
    if _chat_service is None:
        _chat_service = ChatService()
    return _chat_service
