'use client';

import { Search, Filter, Bell } from 'lucide-react';
import { useState } from 'react';

interface SearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export default function SearchFilters({
  searchQuery,
  setSearchQuery,
}: SearchFiltersProps) {
  const [selectedFilter, setSelectedFilter] = useState('Property Type');

  return (
    <div className="sticky top-[88px] z-40 w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
          {/* Search Input */}
          <div className="flex items-center gap-3 bg-slate-50 rounded-full px-5 py-3 w-full lg:w-96 border border-slate-200 transition-all focus-within:bg-white focus-within:border-blue-300 focus-within:shadow-sm hover:border-slate-300">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="City, neighborhood, or address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none flex-1 text-sm text-slate-900 placeholder-slate-500 font-medium"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button className="px-5 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all font-medium">
              Price Range
            </button>
            <button
              onClick={() => setSelectedFilter('Property Type')}
              className={`px-5 py-2.5 text-sm rounded-full transition-all font-medium shadow-sm border ${
                selectedFilter === 'Property Type'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
              }`}
            >
              Property Type
            </button>
            <button className="px-5 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all font-medium">
              Beds & Baths
            </button>
            <button className="hidden sm:inline-block px-5 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all font-medium">
              Amenities
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2.5 ml-auto pl-2 border-l border-slate-200">
              <button className="flex items-center gap-2 px-5 py-2.5 text-sm border border-slate-300 text-slate-700 rounded-full hover:bg-slate-50 hover:border-slate-400 transition-all font-semibold">
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 text-sm bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all font-bold shadow-md hover:shadow-lg">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Save Search</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
