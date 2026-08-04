import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'

type Company = {
  id: string
  name: string
}

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  status: string
  priority: string
  company_id: string | null
  companies: { name: string }[]
}

type TaskForm = {
  title: string
  description: string
  due_date: string
  status: string
  priority: string
  company_id: string
}

const emptyForm: TaskForm = {
  title: '',
  description: '',
  due_date: '',
  status: 'К выполнению',
  priority: 'Обычный',
  company_id: '',
}

export default function TasksPage({ onBack }: { onBack: () => void }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [form, setForm] = useState<TaskForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [filter, setFilter] = useState('Все')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [tasksResult, companiesResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, description, due_date, status, priority, company_id, companies(name)')
        .order('created_at', { ascending: false }),
      supabase.from('companies').select('id, name').order('name'),
    ])

    if (tasksResult.error) {
      setMessage(`Не удалось загрузить задачи: ${tasksResult.error.message}`)
    } else {
      setTasks((tasksResult.data ?? []) as Task[])
    }

    if (companiesResult.error) {
      setMessage(`Не удалось загрузить компании: ${companiesResult.error.message}`)
    } else {
      setCompanies((companiesResult.data ?? []) as Company[])
    }
  }

  function openNewTask() {
    setEditingId(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  function openEditTask(task: Task) {
    setEditingId(task.id)
    setForm({
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ?? '',
      status: task.status,
      priority: task.priority,
      company_id: task.company_id ?? '',
    })
    setIsFormOpen(true)
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      due_date: form.due_date || null,
      status: form.status,
      priority: form.priority,
      company_id: form.company_id || null,
    }

    const { error } = editingId
      ? await supabase.from('tasks').update(values).eq('id', editingId)
      : await supabase.from('tasks').insert(values)

    setSaving(false)

    if (error) {
      setMessage(`Не удалось сохранить задачу: ${error.message}`)
      return
    }

    setIsFormOpen(false)
    setEditingId(null)
    await loadData()
  }

  async function deleteTask(id: string) {
    if (!window.confirm('Удалить задачу?')) return

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      setMessage(`Не удалось удалить задачу: ${error.message}`)
      return
    }

    await loadData()
  }

  const visibleTasks =
    filter === 'Все' ? tasks : tasks.filter((task) => task.status === filter)

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <button className="mb-5 text-blue-700" onClick={onBack}>
          ← Компании
        </button>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Задачи</h1>
              <p className="mt-1 text-slate-500">Всего: {tasks.length}</p>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
              onClick={openNewTask}
            >
              + Добавить задачу
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {['Все', 'К выполнению', 'В работе', 'Готово'].map((status) => (
              <button
                key={status}
                className={
                  filter === status
                    ? 'rounded-lg bg-slate-900 px-3 py-2 text-sm text-white'
                    : 'rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700'
                }
                onClick={() => setFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>

          {message && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {visibleTasks.length === 0 ? (
            <p className="py-12 text-center text-slate-500">
              Здесь пока нет задач.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Задача</th>
                    <th className="px-3 py-3">Компания</th>
                    <th className="px-3 py-3">Срок</th>
                    <th className="px-3 py-3">Приоритет</th>
                    <th className="px-3 py-3">Статус</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTasks.map((task) => (
                    <tr key={task.id} className="border-b last:border-0">
                      <td className="px-3 py-4 font-medium">{task.title}</td>
                      <td className="px-3 py-4">{task.companies?.[0]?.name || '—'}</td>
                      <td className="px-3 py-4">{task.due_date || '—'}</td>
                      <td className="px-3 py-4">{task.priority}</td>
                      <td className="px-3 py-4">{task.status}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-right">
                        <button
                          className="mr-3 text-blue-700"
                          onClick={() => openEditTask(task)}
                        >
                          Изменить
                        </button>
                        <button
                          className="text-red-700"
                          onClick={() => deleteTask(task.id)}
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
              onSubmit={saveTask}
              className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold">
                {editingId ? 'Редактировать задачу' : 'Новая задача'}
              </h2>

              <label className="mt-5 block text-sm font-medium">Название *</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />

              <label className="mt-4 block text-sm font-medium">Компания</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.company_id}
                onChange={(event) => setForm({ ...form, company_id: event.target.value })}
              >
                <option value="">Не выбрана</option>
                {companies.map((company) => (
  <option key={company.id} value={company.id}>
    {company.name}
  </option>
))}
</select>

<label className="mt-4 block text-sm font-medium">Срок</label>
<input
  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
  type="date"
  value={form.due_date}
  onChange={(event) => setForm({ ...form, due_date: event.target.value })}
/>

<label className="mt-4 block text-sm font-medium">Приоритет</label>
<select
  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
  value={form.priority}
  onChange={(event) => setForm({ ...form, priority: event.target.value })}
>
  <option>Низкий</option>
  <option>Обычный</option>
  <option>Высокий</option>
</select>

<label className="mt-4 block text-sm font-medium">Статус</label>
<select
  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
  value={form.status}
  onChange={(event) => setForm({ ...form, status: event.target.value })}
>
  <option>К выполнению</option>
  <option>В работе</option>
  <option>Готово</option>
</select>

<label className="mt-4 block text-sm font-medium">Описание</label>
<textarea
  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
  rows={3}
  value={form.description}
  onChange={(event) =>
    setForm({ ...form, description: event.target.value })
  }
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
    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
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