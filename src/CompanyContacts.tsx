import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'
import MeetingSection from './MeetingSection'

export type CompanyForContacts = {
  id: string
  name: string
}

type Contact = {
  id: string
  first_name: string
  last_name: string | null
  job_title: string | null
  email: string | null
  phone: string | null
  telegram: string | null
}

type ContactForm = {
  first_name: string
  last_name: string
  job_title: string
  email: string
  phone: string
  telegram: string
}

const emptyForm: ContactForm = {
  first_name: '',
  last_name: '',
  job_title: '',
  email: '',
  phone: '',
  telegram: '',
}

export default function CompanyContacts({
  company,
  onBack,
}: {
  company: CompanyForContacts
  onBack: () => void
}) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    loadContacts()
  }, [company.id])

  async function loadContacts() {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, job_title, email, phone, telegram')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(`Не удалось загрузить контакты: ${error.message}`)
      return
    }

    setContacts((data ?? []) as Contact[])
  }
  function openNewContact() {
  setEditingId(null)
  setForm(emptyForm)
  setIsFormOpen(true)
}

function openEditContact(contact: Contact) {
  setEditingId(contact.id)
  setForm({
    first_name: contact.first_name,
    last_name: contact.last_name ?? '',
    job_title: contact.job_title ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    telegram: contact.telegram ?? '',
  })
  setIsFormOpen(true)
}

 async function saveContact(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setSaving(true)
  setMessage('')

  const values = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim() || null,
    job_title: form.job_title.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    telegram: form.telegram.trim() || null,
  }

  const { error } = editingId
    ? await supabase.from('contacts').update(values).eq('id', editingId)
    : await supabase.from('contacts').insert({
        ...values,
        company_id: company.id,
      })

  setSaving(false)

  if (error) {
    setMessage(`Не удалось сохранить контакт: ${error.message}`)
    return
  }

  setEditingId(null)
  setForm(emptyForm)
  setIsFormOpen(false)
  await loadContacts()
}

  async function deleteContact(id: string) {
    if (!window.confirm('Удалить контакт?')) return

    const { error } = await supabase.from('contacts').delete().eq('id', id)

    if (error) {
      setMessage(`Не удалось удалить контакт: ${error.message}`)
      return
    }

    await loadContacts()
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <button className="mb-5 text-blue-700" onClick={onBack}>
          ← Все компании
        </button>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm text-slate-500">Компания</p>
              <h1 className="text-3xl font-bold text-slate-900">
                {company.name}
              </h1>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
              onClick={openNewContact}
            >
              + Добавить контакт
            </button>
          </div>

          {message && (
            <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          <h2 className="mt-8 text-xl font-semibold">Контакты</h2>

          {contacts.length === 0 ? (
            <p className="py-10 text-center text-slate-500">
              Контактов пока нет.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Имя</th>
                    <th className="px-3 py-3">Должность</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Телефон</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b last:border-0">
  <td className="px-3 py-4 font-medium">
    {contact.first_name} {contact.last_name}
  </td>
  <td className="px-3 py-4">{contact.job_title || '—'}</td>
  <td className="px-3 py-4">{contact.email || '—'}</td>
  <td className="px-3 py-4">{contact.phone || '—'}</td>
  <td className="whitespace-nowrap px-3 py-4 text-right">
    <button
      className="mr-3 text-blue-700"
      onClick={() => openEditContact(contact)}
    >
      Изменить
    </button>
    <button
      className="text-red-700"
      onClick={() => deleteContact(contact.id)}
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
<MeetingSection companyId={company.id} contacts={contacts} />
        </section>

        {isFormOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
            <form
              onSubmit={saveContact}
              className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
            >
              <h2 className="text-xl font-semibold">
  {editingId ? 'Редактировать контакт' : 'Новый контакт'}
</h2>

              <label className="mt-5 block text-sm font-medium">Имя *</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.first_name}
                onChange={(event) =>
                  setForm({ ...form, first_name: event.target.value })
                }
                required
              />

              <label className="mt-4 block text-sm font-medium">Фамилия</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.last_name}
                onChange={(event) =>
                  setForm({ ...form, last_name: event.target.value })
                }
              />

              <label className="mt-4 block text-sm font-medium">Должность</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.job_title}
                onChange={(event) =>
                  setForm({ ...form, job_title: event.target.value })
                }
              />

              <label className="mt-4 block text-sm font-medium">Email</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />

              <label className="mt-4 block text-sm font-medium">Телефон</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />

              <label className="mt-4 block text-sm font-medium">Telegram</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={form.telegram}
                onChange={(event) =>
                  setForm({ ...form, telegram: event.target.value })
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