# Semantic Network Analyzer

A powerful tool for analyzing and visualizing semantic networks from text data. Compare word co-occurrence patterns between different groups (e.g., parents vs teachers, customers vs employees, etc.).

## 🎯 Features

- **Upload & Process**: Upload Excel/CSV files containing text responses from different groups
- **Word Unification**: Automatic and manual word mapping (plurals, synonyms, variants)
- **Network Visualization**: Interactive force-directed and clustered layouts
- **Comparative Analysis**: Side-by-side comparison of word usage patterns between groups
- **Centrality Metrics**: Degree, betweenness, closeness, eigenvector centrality
- **Clustering**: Automatic semantic clustering with multiple algorithms
- **Filtering**: By perspective, cluster, score threshold, edge weight
- **Export**: CSV, Excel, and image exports

## 🏗️ Architecture

```
semantic-network-analyzer/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── types/            # TypeScript type definitions
│   │   ├── utils/            # Utility functions
│   │   └── styles/           # CSS/styled-components
│   ├── package.json
│   └── tsconfig.json
├── backend/                  # Python FastAPI backend
│   ├── api/                  # API endpoints
│   ├── core/                 # Core analysis logic
│   ├── utils/                # Utility functions
│   ├── requirements.txt
│   └── main.py
├── docs/                     # Documentation
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 📊 How It Works

### 1. Data Upload
Upload Excel or CSV files containing text responses. Each file represents one group (e.g., "parents.xlsx", "teachers.xlsx").

### 2. Text Processing
- Tokenization and cleaning
- Stopword removal
- Word unification (plurals, synonyms)
- Custom word mappings

### 3. Network Construction
- Build co-occurrence networks for each group
- Calculate edge weights based on co-occurrence frequency
- Compute centrality metrics

### 4. Comparison Analysis
- Normalize scores within each group
- Calculate differences and emphasis
- Identify group-specific patterns

### 5. Visualization
- Interactive network graph
- Filterable data table
- Multiple layout options
- Export capabilities

## 🔧 Configuration

### Word Mappings
Define custom word unifications in the UI or via config file:

```json
{
  "mappings": {
    "collaborate": "collaboration",
    "collaborating": "collaboration",
    "teachers": "teacher"
  },
  "deletions": ["etc", "also", "however"]
}
```

### Stopwords
Customize stopword lists per language or domain.

## 📈 Metrics Explained

| Metric | Description |
|--------|-------------|
| **Degree** | Number of connections a word has |
| **Strength** | Sum of edge weights |
| **Betweenness** | How often a word bridges other words |
| **Closeness** | Average distance to all other words |
| **Eigenvector** | Influence based on connected words' importance |

## 🎨 Visualization Options

### Layouts
- **Force-Directed**: Physics-based organic layout
- **Clustered**: Grouped by semantic clusters

### Color Modes
- **Emphasis**: Red (Group A), Green (Group B), Orange (Balanced)
- **Cluster**: Distinct colors per cluster

### Filters
- Perspective filter (group-specific views)
- Score threshold
- Edge weight threshold
- Cluster selection
- Show/hide individual words

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.
