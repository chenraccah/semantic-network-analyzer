"""
API routes for the semantic network analyzer.
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import pandas as pd
import tempfile
import os
import json
import time

from core import TextProcessor, NetworkBuilder, ComparisonAnalyzer, MultiGroupAnalyzer, get_semantic_analyzer
from core.config import settings

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
    semantic_threshold: float = Form(0.5)
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
    semantic_threshold: float = Form(0.5)
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

        # Read texts from all files
        t1 = time.time()
        texts_list = []
        group_names = []
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
        print(f"[TIMING] File reading: {time.time() - t1:.2f}s")

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

        return {
            "success": True,
            **results,
            **num_texts,
            "semantic_enabled": use_semantic_bool,
            "semantic_edges_added": semantic_edges_added,
            "processing_time": round(total_time, 2)
        }

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
    delete_words: str = Form("[]")
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
async def get_default_stopwords():
    """Get the default stopwords list."""
    return {
        "stopwords": list(TextProcessor.DEFAULT_STOPWORDS)
    }


@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    text_column: int = Form(1),
    num_rows: int = Form(5)
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
