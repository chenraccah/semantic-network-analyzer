import { useState } from 'react';
import {
  Network,
  BarChart3,
  Users,
  Zap,
  FileText,
  GitCompare,
  ArrowRight,
  Check,
  ChevronDown,
  Play
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const features = [
    {
      icon: Network,
      title: 'Network Visualization',
      description: 'Transform text data into interactive network graphs. Explore relationships between concepts with intuitive force-directed layouts.'
    },
    {
      icon: GitCompare,
      title: 'Multi-Group Comparison',
      description: 'Compare semantic patterns across different groups, time periods, or sources. Identify unique and shared concepts at a glance.'
    },
    {
      icon: BarChart3,
      title: 'Advanced Metrics',
      description: 'Analyze centrality, clustering, betweenness, and more. Discover key themes and influential concepts in your data.'
    },
    {
      icon: Zap,
      title: 'AI-Powered Insights',
      description: 'Optional semantic analysis using state-of-the-art NLP models to discover conceptual similarities beyond word co-occurrence.'
    },
    {
      icon: Users,
      title: 'Community Detection',
      description: 'Automatically identify clusters and communities in your data using the Louvain algorithm for modularity optimization.'
    },
    {
      icon: FileText,
      title: 'Export & Share',
      description: 'Export your results in multiple formats: CSV, Excel, JSON, GraphML, and high-resolution images for publications.'
    }
  ];

  const steps = [
    {
      num: '01',
      title: 'Upload Your Data',
      description: 'Upload CSV or Excel files containing your text data. Support for multiple groups with customizable column mapping.'
    },
    {
      num: '02',
      title: 'Configure Analysis',
      description: 'Set thresholds, choose clustering methods, apply word mappings, and enable semantic analysis as needed.'
    },
    {
      num: '03',
      title: 'Explore Results',
      description: 'Interact with network visualizations, filter by metrics, and drill down into clusters and individual nodes.'
    },
    {
      num: '04',
      title: 'Export & Report',
      description: 'Download data tables, export graph images, and generate reports for your research or business needs.'
    }
  ];

  const useCases = [
    {
      title: 'Academic Research',
      description: 'Analyze interview transcripts, survey responses, or literature reviews to identify thematic patterns.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Market Research',
      description: 'Compare customer feedback across segments, products, or time periods to uncover insights.',
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Social Media Analysis',
      description: 'Map discourse patterns, trending topics, and community discussions across platforms.',
      color: 'from-orange-500 to-red-500'
    },
    {
      title: 'Content Strategy',
      description: 'Analyze competitor content, identify topic gaps, and optimize your content strategy.',
      color: 'from-green-500 to-teal-500'
    }
  ];

  const faqs = [
    {
      question: 'What file formats are supported?',
      answer: 'We support CSV and Excel (.xlsx) files. Your data should have at least one text column for analysis.'
    },
    {
      question: 'How does semantic analysis work?',
      answer: 'Semantic analysis uses transformer-based NLP models to identify conceptually similar terms, even if they don\'t co-occur in the same context. This is optional and can be enabled in the configuration.'
    },
    {
      question: 'Can I analyze multiple groups?',
      answer: 'Yes! You can upload separate files for each group (e.g., different time periods, demographics, or sources) and compare their semantic networks side by side.'
    },
    {
      question: 'Is my data secure?',
      answer: 'Your data is processed securely and is not stored permanently on our servers. Analysis results can be saved to your account if you choose.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Network className="w-8 h-8 text-primary-500" />
              <span className="text-xl font-bold text-gray-900">SNA</span>
            </button>
            <div className="flex items-center gap-4">
              <button
                onClick={onSignIn}
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Sign In
              </button>
              <button
                onClick={onGetStarted}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              Powered by Advanced NLP
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
              Unlock Hidden Patterns in
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-purple-600"> Your Text Data</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Transform unstructured text into interactive semantic networks. Discover relationships, compare groups, and gain insights with powerful visualization tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={onGetStarted}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-500 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-primary-600 hover:to-purple-700 transition-all shadow-lg shadow-primary-500/25"
              >
                Start Analyzing Free
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors">
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>
          </div>

          {/* Hero Image/Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-gray-400 text-sm">Semantic Network Analyzer</span>
              </div>
              <div className="p-8">
                <div className="grid grid-cols-3 gap-6">
                  {/* Simulated Network */}
                  <div className="col-span-2 bg-gray-800/50 rounded-xl p-6 h-64 flex items-center justify-center relative overflow-hidden">
                    <svg viewBox="0 0 400 200" className="w-full h-full">
                      {/* Edges */}
                      <line x1="200" y1="100" x2="100" y2="50" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
                      <line x1="200" y1="100" x2="300" y2="50" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
                      <line x1="200" y1="100" x2="150" y2="150" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
                      <line x1="200" y1="100" x2="250" y2="150" stroke="#6366f1" strokeWidth="2" opacity="0.5" />
                      <line x1="100" y1="50" x2="50" y2="80" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4" />
                      <line x1="300" y1="50" x2="350" y2="80" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4" />
                      <line x1="150" y1="150" x2="100" y2="180" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4" />
                      <line x1="250" y1="150" x2="300" y2="180" stroke="#8b5cf6" strokeWidth="1.5" opacity="0.4" />
                      {/* Nodes */}
                      <circle cx="200" cy="100" r="20" fill="#6366f1" />
                      <circle cx="100" cy="50" r="14" fill="#8b5cf6" />
                      <circle cx="300" cy="50" r="14" fill="#8b5cf6" />
                      <circle cx="150" cy="150" r="12" fill="#a78bfa" />
                      <circle cx="250" cy="150" r="12" fill="#a78bfa" />
                      <circle cx="50" cy="80" r="8" fill="#c4b5fd" />
                      <circle cx="350" cy="80" r="8" fill="#c4b5fd" />
                      <circle cx="100" cy="180" r="8" fill="#c4b5fd" />
                      <circle cx="300" cy="180" r="8" fill="#c4b5fd" />
                    </svg>
                    <div className="absolute bottom-4 left-4 text-xs text-gray-500">Interactive Network Graph</div>
                  </div>
                  {/* Simulated Stats */}
                  <div className="space-y-4">
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="text-3xl font-bold text-white">1,247</div>
                      <div className="text-gray-400 text-sm">Total Words</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="text-3xl font-bold text-primary-400">384</div>
                      <div className="text-gray-400 text-sm">Shared</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4">
                      <div className="text-3xl font-bold text-purple-400">12</div>
                      <div className="text-gray-400 text-sm">Clusters</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4" id="features">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Deep Text Analysis
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to transform raw text into actionable insights
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-gray-200 hover:border-primary-200 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-500 flex items-center justify-center mb-4 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From raw data to insights in four simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary-300 to-transparent -translate-x-4" />
                )}
                <div className="text-5xl font-bold text-primary-100 mb-4">{step.num}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Built for Researchers & Analysts
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Trusted by professionals across industries
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((useCase, i) => (
              <div key={i} className={`p-6 rounded-2xl bg-gradient-to-br ${useCase.color} text-white`}>
                <h3 className="text-xl font-semibold mb-2">{useCase.title}</h3>
                <p className="text-white/90">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20 px-4 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Start Free, Scale When Ready
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Try all features free. Upgrade for higher limits and advanced exports.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 mb-8">
            <div className="p-6 rounded-xl bg-gray-800 border border-gray-700">
              <div className="text-2xl font-bold mb-1">Free</div>
              <div className="text-gray-400 text-sm mb-4">For exploration</div>
              <ul className="text-left text-sm space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> 2 groups per analysis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> 5 analyses/month</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Basic exports</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 border border-primary-400 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-white text-primary-600 text-xs font-bold rounded-full">POPULAR</div>
              <div className="text-2xl font-bold mb-1">Pro</div>
              <div className="text-primary-100 text-sm mb-4">For professionals</div>
              <ul className="text-left text-sm space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4" /> 5 groups per analysis</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4" /> Unlimited analyses</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4" /> All export formats</li>
              </ul>
            </div>
            <div className="p-6 rounded-xl bg-gray-800 border border-gray-700">
              <div className="text-2xl font-bold mb-1">Enterprise</div>
              <div className="text-gray-400 text-sm mb-4">For teams</div>
              <ul className="text-left text-sm space-y-2">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Unlimited everything</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Priority support</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Custom integrations</li>
              </ul>
            </div>
          </div>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-primary-500 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to Discover Insights in Your Data?
          </h2>
          <p className="text-lg text-white/90 mb-8">
            Join researchers and analysts who trust Semantic Network Analyzer for their text analysis needs.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            Create Free Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Network className="w-6 h-6 text-primary-400" />
            <span className="font-semibold text-white">Semantic Network Analyzer</span>
          </div>
          <div className="text-sm">
            &copy; {new Date().getFullYear()} All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
