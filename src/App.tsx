import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import CompanyContacts from './CompanyContacts'
import TasksPage from './TasksPage'

type Company = {
  id: string
  name: string
  status: string
  website: string | null
  industry: string | null
  notes: string | null
  created_at: string
}

type CompanyForm = {
  name: string
  status: string
  website: string
  industry: string
  notes: string
}

const emptyForm: CompanyForm = {
  name: '',
  status: 'Новый',
  website: '',
  industry: '',
  notes: '',
}

const statuses = ['Новый', 'В работе', 'Клиент', 'Неактивен']

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<CompanyForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isTasksPage, setIsTasksPage] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      },
    )
     
    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) loadCompanies()
  }, [user])

  async function loadCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, status, website, industry, notes, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Не удалось загрузить компании: ${error.message}`)
      return
    }

    setCompanies((data ?? []) as Company[])
  }

  function openNewCompany() {
    setEditingId(null)
    setForm(emptyForm)
    setIsFormOpen(true)
    setMessage('')
  }

  function openEditCompany(company: Company) {
    setEditingId(company.id)
    setForm({
      name: company.name,
      status: company.status,
      website: company.website ?? '',
      industry: company.industry ?? '',
      notes: company.notes ?? '',
    })
    setIsFormOpen(true)
    setMessage('')
  }

  async function saveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const values = {
      name: form.name.trim(),
      status: form.status,
      website: form.website.trim() || null,
      industry: form.industry.trim() || null,
      notes: form.notes.trim() || null,
    }

    const { error } = editingId
      ? await supabase.from('companies').update(values).eq('id', editingId)
      : await supabase.from('companies').insert(values)

    setSaving(false)

    if (error) {
      setMessage(`Не удалось сохранить: ${error.message}`)
      return
    }

    setIsFormOpen(false)
    setForm(emptyForm)
    await loadCompanies()
  }

  async function deleteCompany(id: string) {
    if (!window.confirm('Удалить компанию? Её контакты и встречи также будут удалены.')) {
      return
    }

    const { error } = await supabase.from('companies').delete().eq('id', id)

    if (error) {
      setMessage(`Не удалось удалить: ${error.message}`)
      return
    }

    await loadCompanies()
  }
  async function handleLogin(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setAuthLoading(true)
  setAuthMessage('')

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  setAuthLoading(false)

  if (error) {
    setAuthMessage('Не удалось войти. Проверьте email и пароль.')
  }
}
  const visibleCompanies = companies.filter((company) =>
    [company.name, company.industry, company.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  if (loading) {
    return <p className="p-8 text-slate-600">Загрузка…</p>
  }

  if (!user) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-bold text-slate-900">
          Client Desk CRM
        </h1>
        <p className="mt-2 text-slate-600">
          Войдите в рабочий аккаунт.
        </p>

        <label className="mt-6 block text-sm font-medium">Email</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label className="mt-4 block text-sm font-medium">Пароль</label>
        <input
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {authMessage && (
          <p className="mt-4 text-sm text-red-700">{authMessage}</p>
        )}

        <button
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
          disabled={authLoading}
        >
          {authLoading ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
  if (isTasksPage) {
  return <TasksPage onBack={() => setIsTasksPage(false)} />
}
  if (selectedCompany) {
  return (
    <CompanyContacts
      company={selectedCompany}
      onBack={() => setSelectedCompany(null)}
    />
  )
}

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Client Desk CRM</h1>
            <p className="mt-1 text-slate-600">{user.email}</p>
          </div>
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
            onClick={() => supabase.auth.signOut()}
          >
            Выйти
          </button>
          <button
             className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            onClick={() => setIsTasksPage(true)}
          >
            Задачи
          </button>
        </header>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold">Компании</h2>
              <p className="text-sm text-slate-500">
                Всего: {companies.length}
              </p>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
              onClick={openNewCompany}
            >
              + Добавить компанию
            </button>
          </div>

          <input
            className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Поиск по названию, отрасли или статусу"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {message && (
            <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {visibleCompanies.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              Компаний пока нет. Добавьте первую.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Компания</th>
                    <th className="px-3 py-3">Отрасль</th>
                    <th className="px-3 py-3">Статус</th>
                    <th className="px-3 py-3">Сайт</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCompanies.map((company) => (
                    <tr key={company.id} className="border-b last:border-0">
                      <td className="px-3 py-4">
                      <button
                      className="text-lg font-bold text-blue-700 hover:underline"
                      onClick={() => setSelectedCompany(company)}
                      >
                      {company.name}
                      </button>
                      </td>
                      <td className="px-3 py-4">{company.industry || '—'}</td>
                      <td className="px-3 py-4">{company.status}</td>
                      <td className="px-3 py-4">
                        {company.website ? (
                          <a
                            className="text-blue-700 underline"
                            href={company.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Открыть
                          </a>
                        ) : '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-right">
  <button
    className="mr-3 text-blue-700"
    onClick={() => setSelectedCompany(company)}
  >
    Контакты
  </button>

  <button
    className="mr-3 text-blue-700"
    onClick={() => openEditCompany(company)}
  >
    Изменить
  </button>

  <button
    className="text-red-700"
    onClick={() => deleteCompany(company.id)}
  >
    Удалить
  </button>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isFormOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
            <form
              onSubmit={saveCompany}
              className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold">
                {editingId ? 'Редактировать компанию' : 'Новая компания'}
              </h2>

              <label className="mt-5 block text-sm font-medium">Название *</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />

              <label className="mt-4 block text-sm font-medium">Статус</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>

              <label className="mt-4 block text-sm font-medium">Отрасль</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.industry}
                onChange={(event) => setForm({ ...form, industry: event.target.value })}
              />

              <label className="mt-4 block text-sm font-medium">Сайт</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="https://example.com"
                value={form.website}
                onChange={(event) => setForm({ ...form, website: event.target.value })}
              />

              <label className="mt-4 block text-sm font-medium">Комментарий</label>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2"
                  onClick={() => setIsFormOpen(false)}
                >
                  Отмена
                </button>
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-60"
                  disabled={saving}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  )
}