'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserSupabase } from '@/lib/supabase/client'
import type { Category } from '@/lib/types'

const inputClass =
  'w-full rounded-[10px] border border-white/10 bg-background px-3.5 py-2 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 max-[640px]:text-[15px]'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function refresh(uid: string) {
    const supabase = createBrowserSupabase()
    const { data, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', uid)
      .order('name', { ascending: true })
    if (fetchError) {
      setError(fetchError.message)
      return
    }
    setCategories((data ?? []) as Category[])
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const supabase = createBrowserSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setError('You must be signed in to manage categories.')
          setLoading(false)
        }
        return
      }
      if (cancelled) return
      setUserId(user.id)
      await refresh(user.id)
      if (!cancelled) setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function addCategory() {
    const name = newName.trim()
    if (!name || !userId) return
    setBusy(true)
    setError(null)
    const supabase = createBrowserSupabase()
    const { error: insertError } = await supabase.from('categories').insert({ user_id: userId, name })
    if (insertError) {
      setError(insertError.message)
    } else {
      setNewName('')
      await refresh(userId)
    }
    setBusy(false)
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditName(cat.name)
  }

  async function saveEdit(cat: Category) {
    const name = editName.trim()
    if (!name || !userId) return
    if (name === cat.name) {
      setEditingId(null)
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createBrowserSupabase()
    const { error: updateError } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', cat.id)
    if (updateError) {
      setError(updateError.message)
      setBusy(false)
      return
    }
    // Keep purchases in sync with the renamed category (RLS scopes to the user).
    const { error: repointError } = await supabase
      .from('purchases')
      .update({ category: name })
      .eq('category', cat.name)
    if (repointError) {
      setError(repointError.message)
      setBusy(false)
      return
    }
    setEditingId(null)
    await refresh(userId)
    setBusy(false)
  }

  async function deleteCategory(cat: Category) {
    if (!userId) return
    setBusy(true)
    setError(null)
    const supabase = createBrowserSupabase()
    const { error: deleteError } = await supabase.from('categories').delete().eq('id', cat.id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      await refresh(userId)
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8 lg:py-10">
      <Link
        href="/catalogue"
        className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-foreground/60 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none max-[640px]:text-[15px]"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to catalogue
      </Link>

      <h1 className="mb-1 text-[22px] font-semibold text-foreground max-[640px]:text-[24px]">Categories</h1>
      <p className="mb-6 text-[13px] text-foreground/60 max-[640px]:text-[15px]">
        Add, rename, or remove the categories you sort purchases into. Renaming updates every purchase using
        that category.
      </p>

      <div className="mb-6 flex items-center gap-2.5">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') addCategory()
          }}
          placeholder="New category name"
          className={inputClass}
          disabled={busy}
        />
        <button
          type="button"
          onClick={addCategory}
          disabled={busy || !newName.trim()}
          className="hoppable hoppable-strong shrink-0 rounded-[10px] px-4 py-2 text-[13px] font-medium disabled:opacity-40 max-[640px]:text-[15px]"
        >
          Add
        </button>
      </div>

      {loading && <p className="text-[13px] text-foreground/50">Loading categories...</p>}

      {!loading && error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {!loading && !error && categories.length === 0 && (
        <div className="rounded-[14px] bg-surface px-6 py-12 text-center">
          <p className="text-[15px] font-medium text-foreground">No categories yet</p>
          <p className="mt-1 text-[13px] text-foreground/60 max-[640px]:text-[14px]">
            Add your first category above to start sorting purchases.
          </p>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <ul className="flex flex-col gap-2">
          {categories.map(cat => (
            <li
              key={cat.id}
              className="flex items-center gap-2.5 rounded-[12px] bg-surface px-3.5 py-2.5"
            >
              {editingId === cat.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(cat)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className={inputClass}
                    autoFocus
                    disabled={busy}
                  />
                  <button
                    type="button"
                    onClick={() => saveEdit(cat)}
                    disabled={busy || !editName.trim()}
                    className="hoppable shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] disabled:opacity-40 max-[640px]:text-[14px]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    disabled={busy}
                    className="shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] text-foreground/60 hover:text-foreground max-[640px]:text-[14px]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-[14px] text-foreground max-[640px]:text-[15px]">
                    {cat.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(cat)}
                    disabled={busy}
                    className="hoppable shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] disabled:opacity-40 max-[640px]:text-[14px]"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat)}
                    disabled={busy}
                    className="hoppable shrink-0 rounded-[8px] px-3 py-1.5 text-[13px] disabled:opacity-40 max-[640px]:text-[14px]"
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
