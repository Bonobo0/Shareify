import { create } from 'zustand'

const useSearchStore = create((set) => ({
  query: '',
  fileTypes: [],
  topics: [],
  aiResults: [],
  isLoading: false,
  indexingFiles: {},

  setQuery: (query) => set({ query }),
  setFileTypes: (fileTypes) => set({ fileTypes }),
  setTopics: (topics) => set({ topics }),
  setAiResults: (aiResults) => set({ aiResults }),
  setIsLoading: (isLoading) => set({ isLoading }),

  addIndexingFile: (fileStatus) =>
    set((state) => ({
      indexingFiles: {
        ...state.indexingFiles,
        [fileStatus.fileId]: fileStatus,
      },
    })),

  updateIndexingFile: (fileId, status) =>
    set((state) => ({
      indexingFiles: {
        ...state.indexingFiles,
        [fileId]: { ...state.indexingFiles[fileId], ...status },
      },
    })),

  removeIndexingFile: (fileId) =>
    set((state) => {
      const next = { ...state.indexingFiles }
      delete next[fileId]
      return { indexingFiles: next }
    }),

  resetSearch: () => set({ query: '', fileTypes: [], topics: [], aiResults: [] }),
}))

export default useSearchStore
