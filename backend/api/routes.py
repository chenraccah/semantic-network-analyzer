"""
API routes for the semantic network analyzer.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pandas as pd
import tempfile
import os
import json
import time

from core import TextProcessor, NetworkBuilder, ComparisonAnalyzer, MultiGroupAnalyzer, get_semantic_analyzer, get_chat_service
from core.config import settings
from core.auth import get_current_user, TokenData
from core.tier_limits import get_tier_limits, TIER_LIMITS, TIER_PRICING
from core.supabase_client import (
    get_user_profile,
    increment_analysis_count,
    increment_chat_count,
    check_analysis_limit,
    check_chat_limit,
    check_groups_limit,
    check_semantic_enabled,
    check_export_enabled,
    log_usage
)

router = APIRouter()


class WordMapping(BaseModel):
    """Word mapping model."""
    source: str
    target: str


class AnalysisConfig(BaseModel):
    """Analysis configuration model."""
    group_a_name: str = "Group A"
    group_b_name: str = "Group B"
    text_column: int = 1  # 0-indexed column with text
    min_frequency: int = 1
    min_score_threshold: float = 2.0
    cluster_method: str = "louvain"
    word_mappings: Optional[Dict[str, str]] = None
    delete_words: Optional[List[str]] = None
    unify_plurals: bool = True


def read_file_texts(file: UploadFile, text_column: int = 1) -> List[str]:
    """
    Read texts from uploaded file.
    
    Args:
        file: Uploaded file
        text_column: Column index containing text (0-indexed)
        
    Returns:
        List of text strings
    """
    # Save to temp file
    suffix = os.path.splitext(file.filename)[1].lower()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = file.file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Read based on file type
        if suffix in ['.xlsx', '.xls']:
            df = pd.read_excel(tmp_path)
        elif suffix == '.csv':
            df = pd.read_csv(tmp_path)
        elif suffix == '.tsv':
            df = pd.read_csv(tmp_path, sep='\t')
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
        
        # Get text column
        if text_column >= len(df.columns):
            raise HTTPException(
                status_code=400, 
                detail=f"Column {text_column} not found. File has {len(df.columns)} columns."
            )
        
        texts = df.iloc[:, text_column].dropna().astype(str).tolist()
        
        return texts
    
    finally:
        # Clean up temp file
        os.unlink(tmp_path)


@router.post("/analyze/single")
async def analyze_single_group(
    file: UploadFile = File(...),
    group_name: str = Form("Group"),
    text_column: int = Form(1),
    min_frequency: int = Form(1),
    cluster_method: str = Form("louvain"),
    word_mappings: str = Form("{}"),
    delete_words: str = Form("[]"),
    use_semantic: str = Form("false"),
    semantic_threshold: float = Form(0.5),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Analyze a single group's text data.

    Args:
        file: Excel/CSV file with text data
        group_name: Name for this group
        text_column: Column index with text (0-indexed)
        min_frequency: Minimum word frequency
        cluster_method: Clustering method
        word_mappings: JSON string of word mappings
        delete_words: JSON string of words to delete
        use_semantic: Enable semantic similarity edges
        semantic_threshold: Minimum similarity for semantic edges (0-1)

    Returns:
        Network analysis results
    """
    try:
        # Parse JSON strings
        mappings = json.loads(word_mappings)
        deletions = json.loads(delete_words)

        # Read texts
        texts = read_file_texts(file, text_column)

        if not texts:
            raise HTTPException(status_code=400, detail="No texts found in file")

        # Create processor and builder
        processor = TextProcessor(
            word_mappings=mappings,
            delete_words=set(deletions),
            unify_plurals=True
        )

        builder = NetworkBuilder(processor)

        # Build network
        builder.build_network(texts, min_frequency=min_frequency)

        # Add semantic edges if enabled
        use_semantic_bool = use_semantic.lower() == "true"
        semantic_edges_added = 0
        if use_semantic_bool:
            semantic_analyzer = get_semantic_analyzer()
            semantic_edges_added = builder.add_semantic_edges(
                semantic_analyzer,
                threshold=semantic_threshold
            )

        # Calculate metrics
        metrics = builder.calculate_centrality_metrics()
        clusters = builder.detect_clusters(method=cluster_method)

        # Get results
        nodes = builder.get_nodes_data(metrics, clusters)
        edges = builder.get_edges_list(include_semantic=use_semantic_bool)
        stats = builder.get_network_stats()

        return {
            "success": True,
            "group_name": group_name,
            "nodes": nodes,
            "edges": edges,
            "stats": stats,
            "num_texts": len(texts),
            "semantic_enabled": use_semantic_bool,
            "semantic_edges_added": semantic_edges_added
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/compare")
async def analyze_comparison(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    group_a_name: str = Form("Group A"),
    group_b_name: str = Form("Group B"),
    text_column_a: int = Form(1),
    text_column_b: int = Form(1),
    min_frequency: int = Form(1),
    min_score_threshold: float = Form(2.0),
    cluster_method: str = Form("louvain"),
    word_mappings: str = Form("{}"),
    delete_words: str = Form("[]"),
    use_semantic: str = Form("false"),
    semantic_threshold: float = Form(0.5),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Compare two groups' text data.

    Args:
        file_a: Excel/CSV file for group A
        file_b: Excel/CSV file for group B
        group_a_name: Name for group A
        group_b_name: Name for group B
        text_column_a: Column index with text for group A (0-indexed)
        text_column_b: Column index with text for group B (0-indexed)
        min_frequency: Minimum word frequency
        min_score_threshold: Minimum normalized score threshold
        cluster_method: Clustering method
        word_mappings: JSON string of word mappings
        delete_words: JSON string of words to delete
        use_semantic: Enable semantic similarity edges
        semantic_threshold: Minimum similarity for semantic edges (0-1)

    Returns:
        Comparison analysis results
    """
    try:
        start_time = time.time()

        # Parse JSON strings
        mappings = json.loads(word_mappings)
        deletions = json.loads(delete_words)

        # Read texts from both files
        t1 = time.time()
        texts_a = read_file_texts(file_a, text_column_a)
        texts_b = read_file_texts(file_b, text_column_b)
        print(f"[TIMING] File reading: {time.time() - t1:.2f}s")

        if not texts_a:
            raise HTTPException(status_code=400, detail=f"No texts found in {group_a_name} file")
        if not texts_b:
            raise HTTPException(status_code=400, detail=f"No texts found in {group_b_name} file")

        # Create analyzer
        analyzer = ComparisonAnalyzer(
            group_a_name=group_a_name,
            group_b_name=group_b_name,
            word_mappings=mappings,
            delete_words=set(deletions),
            unify_plurals=True
        )

        # Run analysis
        t2 = time.time()
        results = analyzer.analyze(
            texts_a=texts_a,
            texts_b=texts_b,
            min_frequency=min_frequency,
            min_score_threshold=min_score_threshold,
            cluster_method=cluster_method
        )
        print(f"[TIMING] Co-occurrence analysis: {time.time() - t2:.2f}s")

        # Add semantic edges if enabled
        use_semantic_bool = use_semantic.lower() == "true"
        semantic_edges_added = 0
        if use_semantic_bool:
            t3 = time.time()
            semantic_analyzer = get_semantic_analyzer()
            # Add semantic edges to both group networks
            semantic_edges_added += analyzer.builder_a.add_semantic_edges(
                semantic_analyzer, threshold=semantic_threshold
            )
            semantic_edges_added += analyzer.builder_b.add_semantic_edges(
                semantic_analyzer, threshold=semantic_threshold
            )
            print(f"[TIMING] Semantic analysis: {time.time() - t3:.2f}s")

        total_time = time.time() - start_time
        print(f"[TIMING] Total: {total_time:.2f}s")

        return {
            "success": True,
            **results,
            "num_texts_a": len(texts_a),
            "num_texts_b": len(texts_b),
            "semantic_enabled": use_semantic_bool,
            "semantic_edges_added": semantic_edges_added,
            "processing_time": round(total_time, 2)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/multi")
async def analyze_multi_group(
    group_configs: str = Form(...),  # JSON array: [{name, text_column}, ...]
    min_frequency: int = Form(1),
    min_score_threshold: float = Form(2.0),
    cluster_method: str = Form("louvain"),
    word_mappings: str = Form("{}"),
    delete_words: str = Form("[]"),
    use_semantic: str = Form("false"),
    semantic_threshold: float = Form(0.5),
    file_0: UploadFile = File(None),
    file_1: UploadFile = File(None),
    file_2: UploadFile = File(None),
    file_3: UploadFile = File(None),
    file_4: UploadFile = File(None),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Analyze 1 to N groups of text data.

    Args:
        group_configs: JSON array of group configurations [{name, text_column}, ...]
        min_frequency: Minimum word frequency
        min_score_threshold: Minimum normalized score threshold
        cluster_method: Clustering method
        word_mappings: JSON string of word mappings
        delete_words: JSON string of words to delete
        use_semantic: Enable semantic similarity edges
        semantic_threshold: Minimum similarity for semantic edges (0-1)
        file_0 to file_4: Uploaded files for each group

    Returns:
        Analysis results for all groups
    """
    try:
        start_time = time.time()

        # Parse configurations
        configs = json.loads(group_configs)
        mappings = json.loads(word_mappings)
        deletions = json.loads(delete_words)
        use_semantic_bool = use_semantic.lower() == "true"

        # ============================================================
        # USAGE LIMIT CHECKS
        # ============================================================

        # Check daily analysis limit
        analysis_limit = await check_analysis_limit(current_user.user_id)
        if not analysis_limit.get("allowed"):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "limit_exceeded",
                    "type": "analysis_limit",
                    "message": analysis_limit.get("message"),
                    "tier": analysis_limit.get("tier"),
                    "limit": analysis_limit.get("limit"),
                    "used": analysis_limit.get("used")
                }
            )

        # Check groups limit
        num_groups = len(configs)
        groups_limit = await check_groups_limit(current_user.user_id, num_groups)
        if not groups_limit.get("allowed"):
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "limit_exceeded",
                    "type": "groups_limit",
                    "message": groups_limit.get("message"),
                    "tier": groups_limit.get("tier"),
                    "max_groups": groups_limit.get("max_groups"),
                    "requested_groups": num_groups
                }
            )

        # Check semantic feature access
        if use_semantic_bool:
            semantic_check = await check_semantic_enabled(current_user.user_id)
            if not semantic_check.get("allowed"):
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "feature_disabled",
                        "type": "semantic_disabled",
                        "message": semantic_check.get("message"),
                        "tier": semantic_check.get("tier")
                    }
                )

        # Get tier limits for word count check
        tier = analysis_limit.get("tier", "free")
        limits = get_tier_limits(tier)
        max_words = limits.get("max_words")
        max_file_size = limits.get("max_file_size_mb", 50) * 1024 * 1024  # Convert to bytes

        # ============================================================
        # END LIMIT CHECKS
        # ============================================================

        # Collect files in order
        all_files = [file_0, file_1, file_2, file_3, file_4]
        files = [f for f in all_files[:len(configs)] if f is not None]

        if len(files) != len(configs):
            raise HTTPException(
                status_code=400,
                detail=f"Expected {len(configs)} files, got {len(files)}"
            )

        if len(files) == 0:
            raise HTTPException(status_code=400, detail="At least one file is required")

        # Check file sizes against tier limit
        for i, file in enumerate(files):
            # Read file to check size
            content = await file.read()
            file_size = len(content)
            await file.seek(0)  # Reset file position

            if file_size > max_file_size:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "error": "limit_exceeded",
                        "type": "file_size",
                        "message": f"File {i+1} exceeds size limit ({limits.get('max_file_size_mb')} MB). Upgrade for larger files.",
                        "tier": tier,
                        "max_size_mb": limits.get("max_file_size_mb"),
                        "file_size_mb": round(file_size / (1024 * 1024), 2)
                    }
                )

        # Read texts from all files
        t1 = time.time()
        texts_list = []
        group_names = []
        total_words = 0

        for i, (file, config) in enumerate(zip(files, configs)):
            text_column = config.get('text_column', 1)
            texts = read_file_texts(file, text_column)
            if not texts:
                raise HTTPException(
                    status_code=400,
                    detail=f"No texts found in file for group {config.get('name', f'Group {i+1}')}"
                )
            texts_list.append(texts)
            group_names.append(config.get('name', f'Group {i+1}'))

            # Count words for limit checking
            for text in texts:
                total_words += len(str(text).split())

        print(f"[TIMING] File reading: {time.time() - t1:.2f}s")

        # Check word count limit
        if max_words is not None and total_words > max_words:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "limit_exceeded",
                    "type": "word_limit",
                    "message": f"Total words ({total_words}) exceeds limit ({max_words}). Upgrade for higher limits.",
                    "tier": tier,
                    "max_words": max_words,
                    "total_words": total_words
                }
            )

        # Create multi-group analyzer
        analyzer = MultiGroupAnalyzer(
            group_names=group_names,
            word_mappings=mappings,
            delete_words=set(deletions),
            unify_plurals=True
        )

        # Run analysis
        t2 = time.time()
        results = analyzer.analyze(
            texts_list=texts_list,
            min_frequency=min_frequency,
            min_score_threshold=min_score_threshold,
            cluster_method=cluster_method
        )
        print(f"[TIMING] Co-occurrence analysis: {time.time() - t2:.2f}s")

        # Add semantic edges if enabled
        use_semantic_bool = use_semantic.lower() == "true"
        semantic_edges_added = 0
        if use_semantic_bool:
            t3 = time.time()
            semantic_analyzer = get_semantic_analyzer()
            for builder in analyzer.builders:
                semantic_edges_added += builder.add_semantic_edges(
                    semantic_analyzer, threshold=semantic_threshold
                )
            print(f"[TIMING] Semantic analysis: {time.time() - t3:.2f}s")

        total_time = time.time() - start_time
        print(f"[TIMING] Total: {total_time:.2f}s")

        # Build response with text counts
        num_texts = {f"num_texts_{analyzer.group_keys[i]}": len(texts_list[i]) for i in range(len(texts_list))}

        # Increment usage counter after successful analysis
        await increment_analysis_count(current_user.user_id)

        # Log usage for analytics
        await log_usage(current_user.user_id, "analysis", {
            "num_groups": len(group_names),
            "total_words": total_words,
            "semantic_enabled": use_semantic_bool,
            "processing_time": round(total_time, 2)
        })

        return {
            "success": True,
            **results,
            **num_texts,
            "semantic_enabled": use_semantic_bool,
            "semantic_edges_added": semantic_edges_added,
            "processing_time": round(total_time, 2)
        }

    except HTTPException:
        # Re-raise HTTP exceptions (including limit errors)
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/word-pairs")
async def analyze_word_pairs(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    group_a_name: str = Form("Group A"),
    group_b_name: str = Form("Group B"),
    text_column: int = Form(1),
    word_mappings: str = Form("{}"),
    delete_words: str = Form("[]"),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get word pair co-occurrences for both groups.
    
    Returns:
        List of word pairs with connection counts
    """
    try:
        # Parse JSON strings
        mappings = json.loads(word_mappings)
        deletions = json.loads(delete_words)
        
        # Read texts
        texts_a = read_file_texts(file_a, text_column)
        texts_b = read_file_texts(file_b, text_column)
        
        # Create analyzer
        analyzer = ComparisonAnalyzer(
            group_a_name=group_a_name,
            group_b_name=group_b_name,
            word_mappings=mappings,
            delete_words=set(deletions),
            unify_plurals=True
        )
        
        # Get word pairs
        pairs = analyzer.get_word_pairs(texts_a, texts_b)
        
        return {
            "success": True,
            "word_pairs": pairs,
            "total_pairs": len(pairs)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stopwords")
async def get_default_stopwords(
    current_user: TokenData = Depends(get_current_user)
):
    """Get the default stopwords list."""
    return {
        "stopwords": list(TextProcessor.DEFAULT_STOPWORDS)
    }


@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    text_column: int = Form(1),
    num_rows: int = Form(5),
    current_user: TokenData = Depends(get_current_user)
):
    """
    Preview uploaded file contents.
    
    Args:
        file: Uploaded file
        text_column: Column index to preview
        num_rows: Number of rows to preview
        
    Returns:
        Preview of file contents
    """
    try:
        suffix = os.path.splitext(file.filename)[1].lower()
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            if suffix in ['.xlsx', '.xls']:
                df = pd.read_excel(tmp_path)
            elif suffix == '.csv':
                df = pd.read_csv(tmp_path)
            elif suffix == '.tsv':
                df = pd.read_csv(tmp_path, sep='\t')
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}")
            
            return {
                "success": True,
                "filename": file.filename,
                "num_rows": len(df),
                "num_columns": len(df.columns),
                "columns": list(df.columns),
                "preview": df.head(num_rows).to_dict(orient='records'),
                "text_column_preview": df.iloc[:num_rows, text_column].tolist() if text_column < len(df.columns) else []
            }
        
        finally:
            os.unlink(tmp_path)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ChatRequest(BaseModel):
    """Chat request model."""
    message: str
    analysis_data: List[Dict[str, Any]]
    stats: Dict[str, Any]
    group_names: List[str]
    group_keys: List[str]
    conversation_history: Optional[List[Dict[str, str]]] = None


@router.post("/chat")
async def chat_about_analysis(
    request: ChatRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Chat with GPT about the analysis results.

    Uses GPT-3.5-turbo for cost efficiency.
    Context is summarized to minimize tokens.

    Args:
        request: Chat request with message and analysis context

    Returns:
        GPT response and updated conversation history
    """
    try:
        # Check chat limit before processing
        chat_limit = await check_chat_limit(current_user.user_id)
        if not chat_limit.get("allowed"):
            return {
                "success": False,
                "error": chat_limit.get("message"),
                "response": None,
                "history": request.conversation_history or [],
                "limit_exceeded": True,
                "tier": chat_limit.get("tier"),
                "chat_limit": chat_limit
            }

        chat_service = get_chat_service()

        if not chat_service.is_available():
            return {
                "success": False,
                "error": "Chat service not configured. Set OPENAI_API_KEY environment variable.",
                "response": None,
                "history": request.conversation_history or []
            }

        # Prepare efficient context
        context = chat_service.prepare_context(
            analysis_data=request.analysis_data,
            stats=request.stats,
            group_names=request.group_names,
            group_keys=request.group_keys,
            max_words=30  # Limit for cost efficiency
        )

        # Get response
        result = chat_service.chat(
            message=request.message,
            context=context,
            conversation_history=request.conversation_history
        )

        if result.get("error"):
            return {
                "success": False,
                "error": result["error"],
                "response": None,
                "history": result.get("history", [])
            }

        # Increment chat count after successful response
        await increment_chat_count(current_user.user_id)

        # Log usage
        await log_usage(current_user.user_id, "chat", {
            "tokens_used": result.get("tokens_used", 0)
        })

        # Get updated chat status for response
        updated_chat_limit = await check_chat_limit(current_user.user_id)

        return {
            "success": True,
            "response": result["response"],
            "history": result["history"],
            "tokens_used": result.get("tokens_used", 0),
            "chat_remaining": updated_chat_limit.get("remaining")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/status")
async def chat_status(
    current_user: TokenData = Depends(get_current_user)
):
    """Check if chat service is available."""
    chat_service = get_chat_service()

    # Also check user's chat limit
    chat_limit = await check_chat_limit(current_user.user_id)

    return {
        "available": chat_service.is_available() and chat_limit.get("allowed", True),
        "model": settings.OPENAI_MODEL if chat_service.is_available() else None,
        "tier": chat_limit.get("tier", "free"),
        "chat_limit": chat_limit
    }


# ============================================================
# User Profile and Subscription Endpoints
# ============================================================

@router.get("/user/profile")
async def get_profile(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get user profile with tier info, usage stats, and limits.
    """
    profile = await get_user_profile(current_user.user_id)
    tier = profile.get("tier", "free")
    limits = get_tier_limits(tier)

    # Get current usage status
    analysis_status = await check_analysis_limit(current_user.user_id)
    chat_status = await check_chat_limit(current_user.user_id)

    return {
        "id": current_user.user_id,
        "email": current_user.email,
        "tier": tier,
        "limits": limits,
        "usage": {
            "analyses_today": profile.get("analyses_today", 0),
            "chat_messages_month": profile.get("chat_messages_month", 0),
        },
        "analysis_status": analysis_status,
        "chat_status": chat_status,
        "stripe_customer_id": profile.get("stripe_customer_id"),
        "stripe_subscription_id": profile.get("stripe_subscription_id"),
    }


@router.get("/user/limits")
async def get_limits(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get all tier limits for display in UI.
    """
    return {
        "tiers": TIER_LIMITS,
        "pricing": TIER_PRICING
    }


@router.get("/user/check-analysis")
async def check_analysis(
    groups: int = 1,
    use_semantic: bool = False,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Pre-check if an analysis would be allowed before running it.
    """
    # Check daily limit
    analysis_limit = await check_analysis_limit(current_user.user_id)
    if not analysis_limit.get("allowed"):
        return {
            "allowed": False,
            "reason": "analysis_limit",
            **analysis_limit
        }

    # Check groups limit
    groups_limit = await check_groups_limit(current_user.user_id, groups)
    if not groups_limit.get("allowed"):
        return {
            "allowed": False,
            "reason": "groups_limit",
            **groups_limit
        }

    # Check semantic access
    if use_semantic:
        semantic_check = await check_semantic_enabled(current_user.user_id)
        if not semantic_check.get("allowed"):
            return {
                "allowed": False,
                "reason": "semantic_disabled",
                **semantic_check
            }

    return {
        "allowed": True,
        "tier": analysis_limit.get("tier", "free"),
        "remaining_analyses": analysis_limit.get("remaining"),
        "max_groups": groups_limit.get("max_groups")
    }


@router.get("/user/check-export")
async def check_export(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Check if user can export data.
    """
    return await check_export_enabled(current_user.user_id)
