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

from core import TextProcessor, NetworkBuilder, ComparisonAnalyzer
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
    delete_words: str = Form("[]")
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
        
        # Calculate metrics
        metrics = builder.calculate_centrality_metrics()
        clusters = builder.detect_clusters(method=cluster_method)
        
        # Get results
        nodes = builder.get_nodes_data(metrics, clusters)
        edges = builder.get_edges_list()
        stats = builder.get_network_stats()
        
        return {
            "success": True,
            "group_name": group_name,
            "nodes": nodes,
            "edges": edges,
            "stats": stats,
            "num_texts": len(texts)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/compare")
async def analyze_comparison(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    group_a_name: str = Form("Group A"),
    group_b_name: str = Form("Group B"),
    text_column: int = Form(1),
    min_frequency: int = Form(1),
    min_score_threshold: float = Form(2.0),
    cluster_method: str = Form("louvain"),
    word_mappings: str = Form("{}"),
    delete_words: str = Form("[]")
):
    """
    Compare two groups' text data.
    
    Args:
        file_a: Excel/CSV file for group A
        file_b: Excel/CSV file for group B
        group_a_name: Name for group A
        group_b_name: Name for group B
        text_column: Column index with text (0-indexed)
        min_frequency: Minimum word frequency
        min_score_threshold: Minimum normalized score threshold
        cluster_method: Clustering method
        word_mappings: JSON string of word mappings
        delete_words: JSON string of words to delete
        
    Returns:
        Comparison analysis results
    """
    try:
        # Parse JSON strings
        mappings = json.loads(word_mappings)
        deletions = json.loads(delete_words)
        
        # Read texts from both files
        texts_a = read_file_texts(file_a, text_column)
        texts_b = read_file_texts(file_b, text_column)
        
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
        results = analyzer.analyze(
            texts_a=texts_a,
            texts_b=texts_b,
            min_frequency=min_frequency,
            min_score_threshold=min_score_threshold,
            cluster_method=cluster_method
        )
        
        return {
            "success": True,
            **results,
            "num_texts_a": len(texts_a),
            "num_texts_b": len(texts_b)
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
