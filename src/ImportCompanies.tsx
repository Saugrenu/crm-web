import { useRef, useState } from 'react'
import { supabase } from './lib/supabase'

type CompanyInput = {
  name: string
  status: string
  industry: string
  website: string
  notes: string
  sourceRow: number
}

type ContactInput = {
  companyName: string
  firstName: string
  lastName: string
  jobTitle: string
  email: string
  phone: string
  telegram: string
  linkedin: string
  notes: string
  sourceRow: number
}

type Preview = {
  companies: CompanyInput[]
  contacts: ContactInput[]
  skippedCompanies: string[]
  skippedContacts: string[]
  errors: string[]
}

const companyHeaders = ['Название', 'Статус', 'Отрасль', 'Сайт', 'Комментарий']
const contactHeaders = ['Компания', 'Имя', 'Фамилия', 'Должность', 'Email', 'Телефон', 'Telegram', 'LinkedIn', 'Комментарий']

function value(row: Record<string, string>, key: string) {
  return (row[key] ?? '').trim()
}

function key(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')
}

function parseCsv(text: string) {
  const delimiter = text.includes(';') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function sheetRows(rows: string[][]) {
  const headers = rows[0] ?? []
  return rows.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ''])),
  )
}

function parseExcelXml(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const rows: string[][] = []
  document.querySelectorAll('Row').forEach((rowNode) => {
    const row: string[] = []
    rowNode.querySelectorAll('Cell').forEach((cellNode) => {
      const index = Number(cellNode.getAttribute('ss:Index') || cellNode.getAttribute('Index') || row.length + 1)
      while (row.length < index - 1) row.push('')
      row.push(cellNode.querySelector('Data')?.textContent ?? '')
    })
    if (row.some(Boolean)) rows.push(row)
  })
  return rows
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function xmlSheet(name: string, headers: string[]) {
  const cells = headers.map((header) => `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`).join('')
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table><Row>${cells}</Row></Table></Worksheet>`
}

function downloadTemplate() {
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${xmlSheet('Компании', companyHeaders)}${xmlSheet('Контакты', contactHeaders)}</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Шаблон_импорта_CRM.xls'
  link.click()
  URL.revokeObjectURL(url)
}

function evaluate(companiesRows: Record<string, string>[], contactsRows: Record<string, string>[], existingCompanies: Set<string>) {
  const preview: Preview = { companies: [], contacts: [], skippedCompanies: [], skippedContacts: [], errors: [] }
  const receivedCompanies = new Set<string>()
  const availableCompanies = new Set(existingCompanies)

  companiesRows.forEach((row, index) => {
    const name = value(row, 'Название')
    const rowNumber = index + 2
    if (!name) {
      preview.errors.push(`Компании, строка ${rowNumber}: не указано название.`)
      return
    }
    const normalized = key(name)
    if (receivedCompanies.has(normalized) || existingCompanies.has(normalized)) {
      preview.skippedCompanies.push(`${name} (строка ${rowNumber})`)
      return
    }
    receivedCompanies.add(normalized)
    availableCompanies.add(normalized)
    preview.companies.push({ name, status: value(row, 'Статус') || 'Новый', industry: value(row, 'Отрасль'), website: value(row, 'Сайт'), notes: value(row, 'Комментарий'), sourceRow: rowNumber })
  })

  const receivedContacts = new Set<string>()
  contactsRows.forEach((row, index) => {
    const companyName = value(row, 'Компания')
    const firstName = value(row, 'Имя')
    const email = value(row, 'Email')
    const rowNumber = index + 2
    if (!companyName || !firstName) {
      preview.errors.push(`Контакты, строка ${rowNumber}: заполните «Компания» и «Имя».`)
      return
    }
    if (!availableCompanies.has(key(companyName))) {
      preview.errors.push(`Контакты, строка ${rowNumber}: компания «${companyName}» не найдена в CRM или листе «Компании».`)
      return
    }
    const duplicateKey = `${key(companyName)}|${email ? key(email) : `${key(firstName)}|${key(value(row, 'Фамилия'))}`}`
    if (receivedContacts.has(duplicateKey)) {
      preview.skippedContacts.push(`${firstName} — ${companyName} (строка ${rowNumber})`)
      return
    }
    receivedContacts.add(duplicateKey)
    preview.contacts.push({ companyName, firstName, lastName: value(row, 'Фамилия'), jobTitle: value(row, 'Должность'), email, phone: value(row, 'Телефон'), telegram: value(row, 'Telegram'), linkedin: value(row, 'LinkedIn'), notes: value(row, 'Комментарий'), sourceRow: rowNumber })
  })
  return preview
}

export default function ImportCompanies({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [message, setMessage] = useState('')
  const [importing, setImporting] = useState(false)

  async function readFile(file: File) {
    setMessage('')
    const { data, error } = await supabase.from('companies').select('name')
    if (error) {
      setMessage(`Не удалось проверить существующие компании: ${error.message}`)
      return
    }
    const existingCompanies = new Set((data ?? []).map((company) => key(company.name)))
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension === 'csv') {
      const rows = sheetRows(parseCsv(await file.text()))
      setPreview(evaluate(rows, [], existingCompanies))
      return
    }
    if (extension !== 'xls') {
      setMessage('Поддерживаются файлы .xls и .csv. Для компаний и контактов используйте шаблон Excel.')
      return
    }
    const xml = await file.text()
    const workbook = new DOMParser().parseFromString(xml, 'application/xml')
    const sheets = Array.from(workbook.querySelectorAll('Worksheet'))
    const companiesSheet = sheets.find((sheet) => sheet.getAttribute('ss:Name') === 'Компании' || sheet.getAttribute('Name') === 'Компании')
    const contactsSheet = sheets.find((sheet) => sheet.getAttribute('ss:Name') === 'Контакты' || sheet.getAttribute('Name') === 'Контакты')
    if (!companiesSheet && !contactsSheet) {
      setMessage('В файле не найдены листы «Компании» или «Контакты». Скачайте и заполните шаблон.')
      return
    }
    setPreview(evaluate(companiesSheet ? sheetRows(parseExcelXml(companiesSheet.outerHTML)) : [], contactsSheet ? sheetRows(parseExcelXml(contactsSheet.outerHTML)) : [], existingCompanies))
  }

  async function importData() {
    if (!preview) return
    setImporting(true)
    setMessage('')
    const { data: beforeCompanies, error: companiesError } = await supabase.from('companies').select('id, name')
    if (companiesError) {
      setMessage(companiesError.message)
      setImporting(false)
      return
    }
    const existing = new Map((beforeCompanies ?? []).map((company) => [key(company.name), company.id]))
    const newCompanies = preview.companies.filter((company) => !existing.has(key(company.name)))
    if (newCompanies.length) {
      const { error } = await supabase.from('companies').insert(newCompanies.map((company) => ({ name: company.name, status: company.status, industry: company.industry || null, website: company.website || null, notes: company.notes || null })))
      if (error) {
        setMessage(`Не удалось импортировать компании: ${error.message}`)
        setImporting(false)
        return
      }
    }
    const { data: allCompanies, error: allCompaniesError } = await supabase.from('companies').select('id, name')
    if (allCompaniesError) {
      setMessage(allCompaniesError.message)
      setImporting(false)
      return
    }
    const companyIds = new Map((allCompanies ?? []).map((company) => [key(company.name), company.id]))
    const { data: existingContacts } = await supabase.from('contacts').select('company_id, email, first_name, last_name')
    const contactKeys = new Set((existingContacts ?? []).map((contact) => `${contact.company_id}|${contact.email ? key(contact.email) : `${key(contact.first_name)}|${key(contact.last_name ?? '')}`}`))
    const contacts = preview.contacts.flatMap((contact) => {
      const companyId = companyIds.get(key(contact.companyName))
      if (!companyId) return []
      const duplicateKey = `${companyId}|${contact.email ? key(contact.email) : `${key(contact.firstName)}|${key(contact.lastName)}`}`
      if (contactKeys.has(duplicateKey)) return []
      contactKeys.add(duplicateKey)
      return [{ company_id: companyId, first_name: contact.firstName, last_name: contact.lastName || null, job_title: contact.jobTitle || null, email: contact.email || null, phone: contact.phone || null, telegram: contact.telegram || null, linkedin: contact.linkedin || null, notes: contact.notes || null }]
    })
    if (contacts.length) {
      const { error } = await supabase.from('contacts').insert(contacts)
      if (error) {
        setMessage(`Компании импортированы, но контакты не добавлены: ${error.message}`)
        setImporting(false)
        await onImported()
        return
      }
    }
    await onImported()
    setImporting(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
      <div className="mx-auto my-8 w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Импорт компаний и контактов</h2><p className="mt-1 text-sm text-slate-600">Сначала данные проверяются. В базу попадут только записи после подтверждения.</p></div>
          <button className="text-slate-500" onClick={onClose}>Закрыть</button>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-lg border border-slate-300 px-4 py-2 font-medium" onClick={downloadTemplate}>Скачать Excel-шаблон</button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white" onClick={() => fileInput.current?.click()}>Выбрать файл</button>
          <input ref={fileInput} className="hidden" type="file" accept=".xls,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); event.currentTarget.value = '' }} />
        </div>
        <p className="mt-3 text-sm text-slate-500">Excel-шаблон содержит листы «Компании» и «Контакты». CSV импортирует только компании.</p>
        {message && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
        {preview && <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-lg bg-emerald-50 p-3 text-sm">Компании<br /><strong>{preview.companies.length}</strong></div><div className="rounded-lg bg-emerald-50 p-3 text-sm">Контакты<br /><strong>{preview.contacts.length}</strong></div><div className="rounded-lg bg-amber-50 p-3 text-sm">Пропущено<br /><strong>{preview.skippedCompanies.length + preview.skippedContacts.length}</strong></div><div className="rounded-lg bg-red-50 p-3 text-sm">Ошибки<br /><strong>{preview.errors.length}</strong></div></div>
          {preview.errors.length > 0 && <div><h3 className="font-medium text-red-800">Исправьте эти строки перед импортом</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
          {(preview.skippedCompanies.length > 0 || preview.skippedContacts.length > 0) && <p className="text-sm text-slate-600">Повторы в файле или уже существующие записи будут пропущены.</p>}
          <div className="flex justify-end gap-3 border-t pt-5"><button className="rounded-lg px-4 py-2" onClick={() => setPreview(null)}>Выбрать другой файл</button><button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50" disabled={preview.errors.length > 0 || importing || (preview.companies.length === 0 && preview.contacts.length === 0)} onClick={importData}>{importing ? 'Импорт…' : `Импортировать (${preview.companies.length + preview.contacts.length})`}</button></div>
        </div>}
      </div>
    </div>
  )
}
