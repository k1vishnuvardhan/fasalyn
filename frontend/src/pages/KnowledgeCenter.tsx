import React from 'react';
import { BookOpen, Sprout, Bug, CloudRain, ChevronRight } from 'lucide-react';

const ARTICLES = [
  { id: 1, title: 'Identifying Tomato Blight Early', category: 'Diseases', icon: Sprout, readTime: '4 min', color: 'text-danger', image: '/images/tomato_blight.png', link: 'https://en.wikipedia.org/wiki/Alternaria_solani' },
  { id: 2, title: 'Natural Predators for Pest Control', category: 'Ecology', icon: Bug, readTime: '5 min', color: 'text-emeraldMain', image: '/images/pest_control.png', link: 'https://en.wikipedia.org/wiki/Biological_pest_control' },
  { id: 3, title: 'Modern Irrigation Techniques', category: 'Best Practices', icon: CloudRain, readTime: '6 min', color: 'text-emeraldMain', image: '/images/healthy_crop.png', link: 'https://en.wikipedia.org/wiki/Irrigation' },
  { id: 4, title: 'Nutrient Deficiencies vs. Disease', category: 'Diagnosis', icon: Sprout, readTime: '7 min', color: 'text-warning', image: '/images/nutrient_deficiency.png', link: 'https://en.wikipedia.org/wiki/Plant_nutrition' },
  { id: 5, title: 'Managing Hornworm Outbreaks', category: 'Pests', icon: Bug, readTime: '4 min', color: 'text-warning', image: '/images/hornworm.png', link: 'https://en.wikipedia.org/wiki/Manduca_quinquemaculata' },
  { id: 6, title: 'Safe Pesticide Application Guidelines', category: 'Safety', icon: BookOpen, readTime: '5 min', color: 'text-emeraldMain', image: '/images/pesticide_safety.png', link: 'https://en.wikipedia.org/wiki/Pesticide_application' },
];

export default function KnowledgeCenter() {
  return (
    <div className="app-page">
      <header>
        <p className="page-eyebrow">Library</p>
        <h1 className="page-title">Knowledge Center</h1>
        <p className="page-subtitle">Learn about diseases, pests, and farming best practices.</p>
      </header>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {ARTICLES.map(article => (
          <div key={article.id} onClick={() => window.open(article.link, '_blank')} className="surface group cursor-pointer overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
            <div className="h-40 w-full overflow-hidden relative">
              <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-3 left-3">
                <div className="bg-background/90 backdrop-blur-sm p-2 rounded-lg shadow-sm">
                  <article.icon size={18} className={article.color} />
                </div>
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col items-start">
              <p className="text-[10px] uppercase font-bold text-textMuted tracking-wider mb-2">{article.category}</p>
              <h3 className="text-lg font-bold text-textMain group-hover:text-emeraldMain transition-colors line-clamp-2">{article.title}</h3>
              <p className="text-sm text-textSub mt-auto pt-4">{article.readTime} read</p>
            </div>
            <div className="px-5 py-3 border-t border-subtle bg-cardHover flex items-center justify-between group-hover:bg-sidebar group-hover:text-white transition-colors">
              <span className="text-sm font-medium">Read Article</span>
              <ChevronRight size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
