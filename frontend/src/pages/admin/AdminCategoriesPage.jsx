import { useState } from 'react'
import { toast } from 'react-toastify'
import { Ban, Eye, Image as ImageIcon, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Section,
  ConfirmDialog,
  DataTable,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from '../../components/admin/AdminUi'
import { btn, input } from '../../components/admin/styles'
import ConditionOptionsCard from '../../components/admin/ConditionOptionsCard'
import ImageUpload from '../../components/ImageUpload'
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { CATEGORY_STATUS } from '../../lib/labels'

// Mô tả dán bao nhiêu cũng được; chỉ vướng giới hạn mỗi lần gửi của server (express.json 2 MB).
const MAX_REQUEST_BYTES = 2 * 1024 * 1024
const byteSize = (value) => new Blob([value]).size

function CategoryForm({ category, onClose, onSaved }) {
  const isNew = !category
  const [form, setForm] = useState({
    CategoryName: category?.CategoryName || '',
    Description: category?.Description || '',
    ImageUrl: category?.ImageUrl || '',
  })
  const [errors, setErrors] = useState({})
  const { busy, run } = useMutation()

  const submit = async (event) => {
    event.preventDefault()
    const name = form.CategoryName.trim().replace(/\s+/g, ' ')
    const next = {}
    if (!name) next.CategoryName = 'Vui lòng nhập tên danh mục'
    else if (name.length > 100) next.CategoryName = 'Tên danh mục tối đa 100 ký tự'
    const body = { CategoryName: name, Description: form.Description.trim(), ImageUrl: form.ImageUrl }
    if (byteSize(JSON.stringify(body)) > MAX_REQUEST_BYTES) next.Description = 'Mô tả quá lớn để gửi (tối đa 2 MB). Hãy rút bớt nội dung.'
    setErrors(next)
    if (Object.keys(next).length) return

    try {
      const result = isNew
        ? await run('post', '/admin/categories', body)
        : await run('patch', `/admin/categories/${category.CategoryId}`, body)
      toast.success(result.message)
      onSaved()
      onClose()
    } catch (err) {
      const message = errorMessage(err)
      // Trùng tên: báo ngay dưới ô nhập.
      if (err?.response?.status === 409) setErrors({ CategoryName: message })
      else toast.error(message)
    }
  }

  return (
    <Modal
      open
      title={isNew ? 'Thêm danh mục' : `Sửa danh mục #${category.CategoryId}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>Hủy</button>
          <button type="submit" form="category-form" className={btn.primary} disabled={busy}>Lưu</button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Tên danh mục *" error={errors.CategoryName}>
          <input
            value={form.CategoryName}
            onChange={(event) => setForm({ ...form, CategoryName: event.target.value })}
            className={input}
            maxLength={100}
            autoFocus
          />
        </Field>
        <Field label="Mô tả" hint={`${form.Description.length.toLocaleString('vi-VN')} ký tự`} error={errors.Description}>
          <textarea
            rows={6}
            value={form.Description}
            onChange={(event) => setForm({ ...form, Description: event.target.value })}
            className={input}
          />
        </Field>
        <ImageUpload label="Ảnh danh mục" value={form.ImageUrl} onChange={(ImageUrl) => setForm((current) => ({ ...current, ImageUrl }))} />
      </form>
    </Modal>
  )
}

export default function AdminCategoriesPage() {
  const [filters, setFilters] = useState({ q: '', status: '', page: 1 })
  const [editing, setEditing] = useState(undefined) // undefined: đóng, null: thêm mới, object: sửa
  const [pending, setPending] = useState(null) // { kind: 'toggle' | 'delete', row }
  const { response, loading, error, reload } = useApi('/admin/categories', filters)
  const { busy, run } = useMutation()
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const confirmPending = async () => {
    const { kind, row } = pending
    try {
      const result =
        kind === 'delete'
          ? await run('delete', `/admin/categories/${row.CategoryId}`)
          : await run('patch', `/admin/categories/${row.CategoryId}`, { Status: row.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })
      toast.success(result.message)
      reload()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  // Xóa danh mục đang có tin: báo ngay, không mở hộp xác nhận.
  const askDelete = (row) => {
    if (Number(row.ListingCount) > 0) {
      toast.error('Không thể xóa danh mục đang được sử dụng, chỉ có thể vô hiệu hóa')
      return
    }
    setPending({ kind: 'delete', row })
  }

  const pendingCount = Number(pending?.row.ListingCount || 0)
  const dialog = !pending
    ? {}
    : pending.kind === 'delete'
      ? { title: 'Xóa danh mục', message: `Xóa danh mục "${pending.row.CategoryName}"? Thao tác không thể hoàn tác.`, confirm: 'Xóa', tone: 'danger' }
      : pending.row.Status === 'ACTIVE'
        ? {
            title: 'Vô hiệu hóa danh mục',
            message:
              pendingCount > 0
                ? `Danh mục đang có ${pendingCount} tin đăng. Danh mục sẽ bị ẩn khỏi form đăng tin mới, các tin cũ vẫn giữ nguyên. Tiếp tục?`
                : `Vô hiệu hóa danh mục "${pending.row.CategoryName}"? Danh mục sẽ chuyển sang "Ẩn".`,
            confirm: 'Vô hiệu hóa',
            tone: 'danger',
          }
        : { title: 'Hiện lại danh mục', message: `Hiện lại danh mục "${pending.row.CategoryName}" trong form đăng tin và bộ lọc?`, confirm: 'Hiện lại', tone: 'primary' }

  const columns = [
    { key: 'CategoryId', sortable: true, title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.CategoryId}</span> },
    {
      key: 'CategoryName',
      sortable: true,
      title: 'Danh mục',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.ImageUrl ? (
            <img src={row.ImageUrl} alt={row.CategoryName} className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-slate-200 text-slate-300" aria-hidden>
              <ImageIcon size={18} />
            </span>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-900">{row.CategoryName}</p>
            {row.Description && (
              <p className="line-clamp-2 max-w-md text-xs text-slate-500" title={row.Description}>
                {row.Description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    { key: 'ListingCount', sortable: true, title: 'Số tin đang dùng', render: (row) => row.ListingCount, className: 'text-right tabular-nums' },
    { key: 'Status', sortable: true, title: 'Trạng thái', render: (row) => <StatusBadge map={CATEGORY_STATUS} value={row.Status} /> },
    { key: 'CreatedAt', sortable: true, title: 'Ngày tạo', render: (row) => formatDate(row.CreatedAt) },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <div className="flex flex-nowrap justify-end gap-0.5 whitespace-nowrap">
          <button type="button" className={btn.ghost} onClick={() => setEditing(row)} aria-label={`Sửa ${row.CategoryName}`}>
            <Pencil size={15} /> Sửa
          </button>
          <button type="button" className={`${btn.ghost} text-slate-600`} onClick={() => setPending({ kind: 'toggle', row })}>
            {row.Status === 'ACTIVE' ? <><Ban size={15} /> Vô hiệu hóa</> : <><Eye size={15} /> Hiện lại</>}
          </button>
          <button type="button" className={`${btn.ghost} text-red-600 hover:bg-red-50`} onClick={() => askDelete(row)}>
            <Trash2 size={15} /> Xóa
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Quản lý danh mục"
        description="Danh mục hàng hóa và lựa chọn tình trạng dùng chung cho biểu mẫu đăng tin, tìm kiếm và bộ lọc. Mọi thao tác được ghi nhật ký."
        actions={
          <button type="button" className={btn.primary} onClick={() => setEditing(null)}>
            <Plus size={16} /> Thêm danh mục
          </button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Section title="Tìm kiếm và lọc" bodyClassName="px-4 pt-4">
            <FilterBar onReset={() => setFilters({ q: '', status: '', page: 1 })}>
              <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tìm tên danh mục" />
              <Field className="w-40">
                <select value={filters.status} onChange={(event) => update({ status: event.target.value })} className={input} aria-label="Trạng thái">
                  <option value="">Mọi trạng thái</option>
                  <option value="ACTIVE">Hiện</option>
                  <option value="INACTIVE">Ẩn</option>
                </select>
              </Field>
            </FilterBar>
          </Section>
          <Section title="Danh sách danh mục" meta={response?.pagination ? `${response.pagination.total} danh mục` : null} flush>
            <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.CategoryId} loading={loading} error={error} onRetry={reload} />
            <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
          </Section>
        </div>
        <ConditionOptionsCard />
      </div>
      {editing !== undefined && <CategoryForm category={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
      <ConfirmDialog
        open={Boolean(pending)}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirm}
        tone={dialog.tone}
        busy={busy}
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      />
    </>
  )
}
