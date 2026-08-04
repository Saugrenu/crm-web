import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './lib/supabase'

type ContactOption = {
  id: string
  first_name: string
  last_name: string | null
}

type Meeting = {
  id: string
  contact_id: string | null
  meeting_at: string
  meeting_type: string
  summary: string | null
  next_step: string | null
}

type MeetingForm = {
  contact_id: string
  meeting_at: string
  meeting_type: string
  summary: string
  next_step: string
}

function currentLocalDateTime() {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const emptyForm: MeetingForm = {
  contact_id: '',
  meeting_at: currentLocalDateTime(),
  meeting_type: 'Звонок',
  summary: '',
  next_step: '',
}

export default function MeetingSection({
  companyId,
  contacts,
}: {
  companyId: string
  contacts: ContactOption[]
}) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [form, setForm] = useState<MeetingForm>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadMeetings()
  }, [companyId])

  async function loadMeetings() {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, contact_id, meeting_at, meeting_type, summary, next_step')
      .eq('company_id', companyId)
      .order('meeting_at', { ascending: false })

    if (error) {
      setMessage(`Не удалось загрузить встречи: ${error.message}`)
      return
    }

    setMeetings((data ?? []) as Meeting[])
  }

  async function saveMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('meetings').insert({
      company_id: companyId,
      contact_id: form.contact_id || null,
      meeting_at: new Date(form.meeting_at).toISOString(),
      meeting_type: form.meeting_type,
      summary: form.summary.trim() || null,
      next_step: form.next_step.trim() || null,
    })

    setSaving(false)

    if (error) {
      setMessage(`Не удалось сохранить встречу: ${error.message}`)
      return
    }

    setForm({ ...emptyForm, meeting_at: currentLocalDateTime() })
    setIsFormOpen(false)
    await loadMeetings()
  }

  async function deleteMeeting(id: string) {
    if (!window.confirm('Удалить встречу?')) return

    const { error } = await supabase.from('meetings').delete().eq('id', id)

    if (error) {
      setMessage(`Не удалось удалить встречу: ${error.message}`)
      return
    }

    await loadMeetings()
  }

  function contactName(contactId: string | null) {
    const contact = contacts.find((item) => item.id === contactId)
    return contact
      ? `${contact.first_name} ${contact.last_name ?? ''}`.trim()
      : '—'
  }

  return (
    <section className="mt-8 border-t pt-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Встречи</h2>
          <p className="text-sm text-slate-500">История общения с клиентом</p>
        </div>
        <button
          className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
          onClick={() => setIsFormOpen(true)}
        >
          + Добавить встречу
        </button>
      </div>

      {message && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {message}
        </p>
      )}

      {meetings.length === 0 ? (
        <p className="py-8 text-center text-slate-500">Встреч пока нет.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-slate-500">
              <tr>
                <th className="px-3 py-3">Дата</th>
                <th className="px-3 py-3">Контакт</th>
                <th className="px-3 py-3">Тип</th>
                <th className="px-3 py-3">Итоги</th>
                <th className="px-3 py-3">Следующий шаг</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="border-b last:border-0">
                  <td className="px-3 py-4">
                    {new Date(meeting.meeting_at).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-3 py-4">{contactName(meeting.contact_id)}</td>
                  <td className="px-3 py-4">{meeting.meeting_type}</td>
                  <td className="px-3 py-4">{meeting.summary || '—'}</td>
                  <td className="px-3 py-4">{meeting.next_step || '—'}</td>
                  <td className="px-3 py-4 text-right">
                    <button
                      className="text-red-700"
                      onClick={() => deleteMeeting(meeting.id)}
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

      {isFormOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900/40 p-4">
          <form
            onSubmit={saveMeeting}
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-xl font-semibold">Новая встреча</h2>

            <label className="mt-5 block text-sm font-medium">Дата и время *</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              type="datetime-local"
              value={form.meeting_at}
              onChange={(event) =>
                setForm({ ...form, meeting_at: event.target.value })
              }
              required
            />

            <label className="mt-4 block text-sm font-medium">Контакт</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.contact_id}
              onChange={(event) =>
                setForm({ ...form, contact_id: event.target.value })
              }
            >
              <option value="">Не выбран</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}
                </option>
              ))}
            </select>

            <label className="mt-4 block text-sm font-medium">Тип</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              value={form.meeting_type}
              onChange={(event) =>
                setForm({ ...form, meeting_type: event.target.value })
              }
            >
              <option>Звонок</option>
              <option>Онлайн-встреча</option>
              <option>Личная встреча</option>
              <option>Переписка</option>
            </select>

            <label className="mt-4 block text-sm font-medium">Итоги</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={3}
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
            />

            <label className="mt-4 block text-sm font-medium">Следующий шаг</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              rows={2}
              value={form.next_step}
              onChange={(event) =>
                setForm({ ...form, next_step: event.target.value })
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
    </section>
  )
}