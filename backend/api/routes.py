"""
API routes for the semantic network analyzer.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pandas as pd
import tempfile
import os
import json
import time

from core import TextProcessor, NetworkBuilder, ComparisonAnalyzer, MultiGroupAnalyzer, get_semantic_analyzer, get_chat_service
from core.config import settings
from core.export_service import export_excel, export_json, export_graphml, export_gexf
from core.cache_service import get_cached, set_cached, hash_content
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
    log_usage,
    update_user_tier,
    update_stripe_customer,
    save_analysis,
    get_saved_analyses,
    get_saved_analysis,
    delete_saved_analysis,
    check_save_enabled
)
from core.stripe_service import (
    create_checkout_session,
    create_customer_portal_session,
    construct_webhook_event,
    get_subscription_tier,
    get_customer_id_from_session,
    get_subscription_from_session
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
    unify_plurals: str = Form("true"),
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
        unify_plurals_bool = unify_plurals.lower() == "true"

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

        # Read file contents for size checks and cache keys
        file_contents = []
        file_hashes = []
        for i, file in enumerate(files):
            content = await file.read()
            file_contents.append(content)
            file_hashes.append(hash_content(content))
            await file.seek(0)

        # Check cache
        cache_config = {
            "group_configs": configs,
            "min_frequency": min_frequency,
            "min_score_threshold": min_score_threshold,
            "cluster_method": cluster_method,
            "word_mappings": mappings,
            "delete_words": deletions,
            "use_semantic": use_semantic_bool,
            "semantic_threshold": semantic_threshold,
            "unify_plurals": unify_plurals_bool,
        }
        cached_result = get_cached(file_hashes, cache_config)
        if cached_result is not None:
            # Increment usage counter even for cached results
            await increment_analysis_count(current_user.user_id)
            return cached_result

        # Check file sizes against tier limit
        for i, content in enumerate(file_contents):
            file_size = len(content)

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

        # Reset file positions after content reads
        for file in files:
            await file.seek(0)

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

        # Extract per-group min score thresholds (fallback to global)
        per_group_thresholds = []
        for config in configs:
            threshold = config.get('min_score_threshold', min_score_threshold)
            per_group_thresholds.append(float(threshold))

        # Create multi-group analyzer
        analyzer = MultiGroupAnalyzer(
            group_names=group_names,
            word_mappings=mappings,
            delete_words=set(deletions),
            unify_plurals=unify_plurals_bool
        )

        # Run analysis
        t2 = time.time()
        results = analyzer.analyze(
            texts_list=texts_list,
            min_frequency=min_frequency,
            min_score_threshold=min_score_threshold,
            per_group_thresholds=per_group_thresholds,
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

        response_data = {
            "success": True,
            **results,
            **num_texts,
            "semantic_enabled": use_semantic_bool,
            "semantic_edges_added": semantic_edges_added,
            "processing_time": round(total_time, 2)
        }

        # Store in cache
        set_cached(file_hashes, cache_config, response_data)

        return response_data

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


# ============================================================
# EXPORT ENDPOINT
# ============================================================

class ExportRequest(BaseModel):
    """Request model for exporting analysis data."""
    format: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    stats: Dict[str, Any]
    group_names: List[str]
    group_keys: List[str]


@router.post("/export")
async def export_analysis(
    request: ExportRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Export analysis data in various formats (Pro+ feature).
    Supported formats: excel, json, graphml, gexf
    """
    # Check export access
    export_check = await check_export_enabled(current_user.user_id)
    if not export_check.get("allowed"):
        raise HTTPException(
            status_code=403,
            detail=export_check.get("message", "Export requires a Pro subscription")
        )

    fmt = request.format.lower()
    try:
        if fmt == "excel":
            data = export_excel(request.nodes, request.edges, request.stats, request.group_names, request.group_keys)
            return Response(
                content=data,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=analysis.xlsx"}
            )
        elif fmt == "json":
            data = export_json(request.nodes, request.edges, request.stats, request.group_names, request.group_keys)
            return Response(
                content=data,
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=analysis.json"}
            )
        elif fmt == "graphml":
            data = export_graphml(request.nodes, request.edges, request.stats, request.group_names, request.group_keys)
            return Response(
                content=data,
                media_type="application/xml",
                headers={"Content-Disposition": "attachment; filename=analysis.graphml"}
            )
        elif fmt == "gexf":
            data = export_gexf(request.nodes, request.edges, request.stats, request.group_names, request.group_keys)
            return Response(
                content=data,
                media_type="application/xml",
                headers={"Content-Disposition": "attachment; filename=analysis.gexf"}
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {fmt}. Use excel, json, graphml, or gexf.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


# ============================================================
# BILLING ENDPOINTS
# ============================================================

class CheckoutRequest(BaseModel):
    """Request model for creating checkout session."""
    tier: str
    success_url: str
    cancel_url: str


class UpdateTierRequest(BaseModel):
    """Request model for directly updating tier (no payment)."""
    tier: str


@router.post("/billing/update-tier")
async def update_tier_direct(
    request: UpdateTierRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Directly update user tier without payment.
    This is a temporary endpoint for testing - will be replaced by Stripe checkout.
    """
    if request.tier not in ('free', 'pro', 'enterprise'):
        raise HTTPException(status_code=400, detail="Invalid tier")

    success = await update_user_tier(current_user.user_id, request.tier)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update tier")

    # Log the tier change
    await log_usage(current_user.user_id, "tier_changed", {"new_tier": request.tier})

    return {"success": True, "tier": request.tier}


@router.post("/billing/checkout")
async def create_checkout(
    request: CheckoutRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Create a Stripe Checkout session for subscription upgrade.
    """
    if request.tier not in ('pro', 'enterprise'):
        raise HTTPException(status_code=400, detail="Invalid tier. Must be 'pro' or 'enterprise'")

    result = create_checkout_session(
        user_id=current_user.user_id,
        user_email=current_user.email or "",
        tier=request.tier,
        success_url=request.success_url,
        cancel_url=request.cancel_url
    )

    if not result:
        raise HTTPException(
            status_code=500,
            detail="Failed to create checkout session. Stripe may not be configured."
        )

    # Log the checkout attempt
    await log_usage(current_user.user_id, "checkout_started", {"tier": request.tier})

    return result


@router.post("/billing/portal")
async def create_portal(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Create a Stripe Customer Portal session for managing subscription.
    """
    profile = await get_user_profile(current_user.user_id)
    customer_id = profile.get("stripe_customer_id")

    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="No billing account found. Please subscribe first."
        )

    # Get return URL from request origin or use default
    return_url = f"{settings.CORS_ORIGINS[0]}/billing" if settings.CORS_ORIGINS else "http://localhost:3001/billing"

    portal_url = create_customer_portal_session(customer_id, return_url)

    if not portal_url:
        raise HTTPException(
            status_code=500,
            detail="Failed to create portal session"
        )

    return {"portal_url": portal_url}


@router.post("/webhooks/stripe")
async def stripe_webhook(request: Request):
    """
    Handle Stripe webhook events for subscription management.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    event = construct_webhook_event(payload, sig_header)

    if not event:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    # Handle the event
    event_type = event.type

    if event_type == "checkout.session.completed":
        session = event.data.object
        user_id = session.metadata.get("user_id")
        tier = session.metadata.get("tier", "pro")

        if user_id:
            # Get customer and subscription IDs
            customer_id = get_customer_id_from_session(session)
            subscription_id = get_subscription_from_session(session)

            # Update user profile with Stripe IDs and tier
            await update_stripe_customer(user_id, customer_id, subscription_id)
            await update_user_tier(user_id, tier)
            await log_usage(user_id, "subscription_started", {"tier": tier})

            print(f"[STRIPE] User {user_id} upgraded to {tier}")

    elif event_type == "customer.subscription.updated":
        subscription = event.data.object
        user_id = subscription.metadata.get("user_id")

        if user_id:
            # Check subscription status
            if subscription.status == "active":
                tier = get_subscription_tier(subscription)
                await update_user_tier(user_id, tier)
                print(f"[STRIPE] User {user_id} subscription updated to {tier}")
            elif subscription.status in ("canceled", "unpaid", "past_due"):
                # Downgrade to free
                await update_user_tier(user_id, "free")
                print(f"[STRIPE] User {user_id} downgraded to free (status: {subscription.status})")

    elif event_type == "customer.subscription.deleted":
        subscription = event.data.object
        user_id = subscription.metadata.get("user_id")

        if user_id:
            await update_user_tier(user_id, "free")
            await log_usage(user_id, "subscription_cancelled", {})
            print(f"[STRIPE] User {user_id} subscription cancelled, downgraded to free")

    return {"status": "success"}


# ============================================================
# SAVED ANALYSES ENDPOINTS
# ============================================================

class SaveAnalysisRequest(BaseModel):
    """Request model for saving an analysis."""
    name: str
    config: Dict[str, Any]
    results: Dict[str, Any]


@router.post("/analyses/save")
async def save_analysis_endpoint(
    request: SaveAnalysisRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Save an analysis for later retrieval.
    """
    # Check if user can save analyses
    save_check = await check_save_enabled(current_user.user_id)

    if not save_check.get("allowed"):
        raise HTTPException(
            status_code=403,
            detail=save_check.get("message", "Saving analyses requires a Pro subscription")
        )

    expires_days = save_check.get("expires_days", 7)

    analysis_id = await save_analysis(
        user_id=current_user.user_id,
        name=request.name,
        config=request.config,
        results=request.results,
        expires_days=expires_days
    )

    if not analysis_id:
        raise HTTPException(status_code=500, detail="Failed to save analysis")

    await log_usage(current_user.user_id, "analysis_saved", {"name": request.name})

    return {
        "success": True,
        "id": analysis_id,
        "expires_days": expires_days
    }


@router.get("/analyses")
async def list_analyses(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get all saved analyses for the current user.
    """
    analyses = await get_saved_analyses(current_user.user_id)

    return {
        "analyses": analyses,
        "count": len(analyses)
    }


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get a specific saved analysis by ID.
    """
    analysis = await get_saved_analysis(current_user.user_id, analysis_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return analysis


@router.delete("/analyses/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Delete a saved analysis.
    """
    success = await delete_saved_analysis(current_user.user_id, analysis_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete analysis")

    return {"success": True}


@router.get("/analyses/check")
async def check_save_access(
    current_user: TokenData = Depends(get_current_user)
):
    """
    Check if user can save analyses.
    """
    return await check_save_enabled(current_user.user_id)


# ============================================================
# GRAPH ALGORITHM ENDPOINTS
# ============================================================

class ShortestPathRequest(BaseModel):
    """Request model for shortest path computation."""
    source: str
    target: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


class EgoNetworkRequest(BaseModel):
    """Request model for ego network extraction."""
    center_word: str
    hops: int = 1
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]


@router.post("/shortest-path")
async def compute_shortest_path(
    request: ShortestPathRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Compute shortest path between two nodes using Dijkstra's algorithm.
    """
    import networkx as nx

    G = nx.Graph()
    for edge in request.edges:
        w = edge.get('weight', 1)
        # Invert weight for Dijkstra (higher weight = shorter distance)
        G.add_edge(edge['from'], edge['to'], weight=1.0 / max(w, 1))

    if request.source not in G or request.target not in G:
        raise HTTPException(status_code=400, detail="Source or target node not found in graph")

    try:
        path = nx.dijkstra_path(G, request.source, request.target, weight='weight')
        length = nx.dijkstra_path_length(G, request.source, request.target, weight='weight')
        return {
            "success": True,
            "path": path,
            "length": round(length, 4),
            "hops": len(path) - 1
        }
    except nx.NetworkXNoPath:
        return {
            "success": False,
            "error": f"No path exists between '{request.source}' and '{request.target}'"
        }


@router.post("/ego-network")
async def compute_ego_network(
    request: EgoNetworkRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Extract ego-network (subgraph) around a center node up to N hops.
    """
    import networkx as nx

    G = nx.Graph()
    for edge in request.edges:
        G.add_edge(edge['from'], edge['to'], weight=edge.get('weight', 1))

    if request.center_word not in G:
        raise HTTPException(status_code=400, detail=f"Node '{request.center_word}' not found in graph")

    hops = max(1, min(request.hops, 3))

    # BFS to find nodes within N hops
    ego_nodes = set()
    current_layer = {request.center_word}
    for _ in range(hops):
        next_layer = set()
        for node in current_layer:
            for neighbor in G.neighbors(node):
                if neighbor not in ego_nodes and neighbor != request.center_word:
                    next_layer.add(neighbor)
        ego_nodes.update(current_layer)
        current_layer = next_layer
    ego_nodes.update(current_layer)

    # Filter edges to ego subgraph
    ego_edges = [
        e for e in request.edges
        if e['from'] in ego_nodes and e['to'] in ego_nodes
    ]

    return {
        "success": True,
        "center": request.center_word,
        "hops": hops,
        "ego_nodes": list(ego_nodes),
        "ego_edges": ego_edges,
        "num_nodes": len(ego_nodes),
        "num_edges": len(ego_edges)
    }
