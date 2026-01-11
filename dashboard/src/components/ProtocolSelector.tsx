import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, Check, ChevronDown, ChevronUp, X } from 'lucide-react'
import type { Protocol, ProtocolCategory } from '../types'
import { api } from '../services/api'

interface ProtocolSelectorProps {
  selectedProtocols: number[]
  onSelectionChange: (protocols: number[]) => void
}

export function ProtocolSelector({ selectedProtocols, onSelectionChange }: ProtocolSelectorProps) {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [categories, setCategories] = useState<ProtocolCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [protocolsData, categoriesData] = await Promise.all([
          api.getProtocols(),
          api.getProtocolCategories(),
        ])
        setProtocols(protocolsData.protocols)
        setCategories(categoriesData.categories)
      } catch (error) {
        console.error('Failed to fetch protocols:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const filteredProtocols = useMemo(() => {
    return protocols.filter((protocol) => {
      const matchesSearch =
        searchTerm === '' ||
        protocol.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        protocol.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
        protocol.id.toString().includes(searchTerm)

      const matchesCategory = !selectedCategory || protocol.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [protocols, searchTerm, selectedCategory])

  const toggleProtocol = (id: number) => {
    if (selectedProtocols.includes(id)) {
      onSelectionChange(selectedProtocols.filter((p) => p !== id))
    } else {
      onSelectionChange([...selectedProtocols, id])
    }
  }

  const selectAll = () => {
    const allIds = filteredProtocols.map((p) => p.id)
    const newSelection = [...new Set([...selectedProtocols, ...allIds])]
    onSelectionChange(newSelection)
  }

  const deselectAll = () => {
    const filteredIds = new Set(filteredProtocols.map((p) => p.id))
    onSelectionChange(selectedProtocols.filter((id) => !filteredIds.has(id)))
  }

  const selectCategory = (categoryId: string) => {
    const categoryProtocols = protocols.filter((p) => p.category === categoryId)
    const categoryIds = categoryProtocols.map((p) => p.id)
    const newSelection = [...new Set([...selectedProtocols, ...categoryIds])]
    onSelectionChange(newSelection)
  }

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700 rounded w-1/3"></div>
          <div className="h-10 bg-slate-700 rounded"></div>
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-8 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Filter className="w-5 h-5 text-blue-400" />
          Protocol Selection
          <span className="text-sm font-normal text-slate-400">
            ({selectedProtocols.length} of {protocols.length} selected)
          </span>
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Search and Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search protocols by name, ID, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={selectedCategory || ''}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.count})
            </option>
          ))}
        </select>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={selectAll}
          className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          Select All Visible
        </button>
        <button
          onClick={deselectAll}
          className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
        >
          Deselect All Visible
        </button>
        <button
          onClick={() => onSelectionChange([])}
          className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
        >
          Clear All
        </button>
      </div>

      {/* Category Quick Select */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => {
          const categoryProtocols = protocols.filter((p) => p.category === cat.id)
          const selectedCount = categoryProtocols.filter((p) =>
            selectedProtocols.includes(p.id)
          ).length
          const isFullySelected = selectedCount === categoryProtocols.length && categoryProtocols.length > 0

          return (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat.id)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                isFullySelected
                  ? 'bg-blue-600 text-white'
                  : selectedCount > 0
                  ? 'bg-blue-900 text-blue-200 border border-blue-600'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {cat.name}
              {selectedCount > 0 && (
                <span className="text-xs opacity-75">({selectedCount})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Protocol List */}
      {isExpanded && (
        <div className="max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
          <div className="grid gap-1 p-2">
            {filteredProtocols.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No protocols match your search criteria
              </div>
            ) : (
              filteredProtocols.map((protocol) => {
                const isSelected = selectedProtocols.includes(protocol.id)
                return (
                  <label
                    key={protocol.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-900/50' : 'hover:bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-slate-500'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProtocol(protocol.id)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">#{protocol.id}</span>
                        <span className="text-white truncate">{protocol.name}</span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{protocol.desc}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                      {protocol.category}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* Selected Protocols Summary */}
      {selectedProtocols.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="text-sm text-slate-400 mb-2">Selected Protocols:</div>
          <div className="flex flex-wrap gap-1.5">
            {selectedProtocols.slice(0, 20).map((id) => {
              const protocol = protocols.find((p) => p.id === id)
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/50 text-blue-200 text-xs rounded"
                >
                  #{id}
                  <button
                    onClick={() => toggleProtocol(id)}
                    className="hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
            {selectedProtocols.length > 20 && (
              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                +{selectedProtocols.length - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
