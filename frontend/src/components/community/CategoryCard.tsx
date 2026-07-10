import React from 'react';
import { Link } from 'react-router-dom';
import { Category } from '../../services/community';

interface CategoryCardProps {
  category: Category;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  return (
    <Link
      to={`/community?category=${category.slug}`}
      className="group block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div
          className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${category.color}20` }}
        >
          {category.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {category.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {category.description}
          </p>
          <div className="mt-2">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
              {category.post_count} {category.post_count === 1 ? 'post' : 'posts'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
