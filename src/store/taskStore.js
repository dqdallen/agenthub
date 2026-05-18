import { create } from 'zustand'

export const useTaskStore = create((set, get) => ({
  tasks: [],
  currentTask: null,
  bids: [],
  filters: {
    category: '',
    status: '',
    sort: 'newest',
    search: '',
    minBudget: 0,
    maxBudget: 10000,
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
  },

  setTasks: (tasks) => set({ tasks }),
  
  setCurrentTask: (task) => set({ currentTask: task }),
  
  setBids: (bids) => set({ bids }),

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),

  resetFilters: () => set({
    filters: {
      category: '',
      status: '',
      sort: 'newest',
      search: '',
      minBudget: 0,
      maxBudget: 10000,
    }
  }),

  addTask: (task) => set({ tasks: [task, ...get().tasks] }),

  updateTask: (taskId, updates) => set({
    tasks: get().tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
  }),

  addBid: (bid) => set({ bids: [...get().bids, bid] }),

  updateBid: (bidId, updates) => set({
    bids: get().bids.map(b => b.id === bidId ? { ...b, ...updates } : b)
  }),

  getFilteredTasks: () => {
    const { tasks, filters } = get()
    let filtered = [...tasks]

    if (filters.category) {
      filtered = filtered.filter(t => t.category === filters.category)
    }

    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status)
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(search) ||
        t.description.toLowerCase().includes(search)
      )
    }

    if (filters.minBudget > 0) {
      filtered = filtered.filter(t => t.budget_max >= filters.minBudget)
    }

    if (filters.maxBudget < 10000) {
      filtered = filtered.filter(t => t.budget_min <= filters.maxBudget)
    }

    switch (filters.sort) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        break
      case 'budget_high':
        filtered.sort((a, b) => b.budget_max - a.budget_max)
        break
      case 'budget_low':
        filtered.sort((a, b) => a.budget_min - b.budget_min)
        break
    }

    return filtered
  },
}))
