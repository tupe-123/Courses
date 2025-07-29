import { useState, useEffect } from 'react'
import { supabase, Course } from '../lib/supabase'

const ITEMS_PER_PAGE = 10
export default function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    // Initial fetch
    fetchCourses()

    // Set up real-time subscription
    const subscription = supabase
      .channel('courses')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'courses' },
        (payload) => {
          console.log('Real-time update:', payload)
          handleRealtimeChange(payload)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    fetchCourses()
  }, [currentPage])
  const fetchCourses = async () => {
    try {
      setLoading(true)
      
      // Get total count
      const { count } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
      
      setTotalCount(count || 0)
      
      // Get paginated data
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE - 1)

      if (error) throw error

      setCourses(data || [])
    } catch (err) {
      console.error('Error fetching courses:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRealtimeChange = (payload: any) => {
    switch (payload.eventType) {
      case 'INSERT':
        // Only add to current page if we're on page 1
        if (currentPage === 1) {
          setCourses(prev => [payload.new as Course, ...prev.slice(0, ITEMS_PER_PAGE - 1)])
        }
        setTotalCount(prev => prev + 1)
        break
      case 'UPDATE':
        setCourses(prev => 
          prev.map(course => 
            course.id === payload.new.id ? payload.new as Course : course
          )
        )
        break
      case 'DELETE':
        setCourses(prev => 
          prev.filter(course => course.id !== payload.old.id)
        )
        setTotalCount(prev => prev - 1)
        break
    }
  }

  const nextPage = () => {
    if (currentPage * ITEMS_PER_PAGE < totalCount) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
  const hasNextPage = currentPage < totalPages
  const hasPrevPage = currentPage > 1

  return { 
    courses, 
    loading, 
    error, 
    currentPage,
    totalPages,
    totalCount,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    refetch: fetchCourses 
  }
}