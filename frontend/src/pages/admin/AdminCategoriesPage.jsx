import { useState } from 'react'
import { toast } from 'react-toastify'
import { Pencil, Plus } from 'lucide-react'
import {
  Card,
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
import { useApi, useMutation } from '../../hooks/useApi'
import { errorMessage } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { CATEGORY_STATUS } from '../../lib/labels'

function CategoryForm({ category, onClose, onSaved }) {
  const isNew = !category
  const [form, setForm] = useState({
    CategoryName: category?.CategoryName || '',
    Description: category?.Description || '',
    Status: category?.Status || 'ACTIVE',
  })
  const [errors, setErrors] = useState({})
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const { busy, run } = useMutation()

  const validate = () => {
    const next = {}
    const name = form.CategoryName.trim()
    if (name.length < 2) next.CategoryName = 'Tên danh mục cần ít nhất 2 ký tự'
    if (name.length > 100) next.CategoryName = 'Tên danh mục tối đa 100 ký tự'
    if (form.Description.length > 300) next.Description = 'Mô tả tối đa 300 ký tự'
    setErrors(next)
    return !Object.keys(next).length
  }

  const save = async () => {
    const body = { CategoryName: form.CategoryName.trim(), Description: form.Description.trim(), Status: form.Status }
    try {
      const result = isNew
        ? await run('post', '/admin/categories', body)
        : await run('patch', `/admin/categories/${category.CategoryId}`, body)
      toast.success(result.message)
      onSaved()
      onClose()
    } catch (err) {
      toast.error(errorMessage(err))
      setConfirmDeactivate(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (!validate()) return
    // Tắt danh mục đang có tin: hỏi lại trước khi lưu.
    if (!isNew && category.Status === 'ACTIVE' && form.Status === 'INACTIVE') setConfirmDeactivate(true)
    else save()
  }

  return (
    <Modal
      open
      title={isNew ? 'Thêm danh mục' : `Sửa danh mục #${category.CategoryId}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>Hủy</button>
          <button type="submit" form="category-form" className={btn.primary} disabled={busy}>
            {isNew ? 'Thêm' : 'Lưu thay đổi'}
          </button>
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
        <Field label="Mô tả" hint={`${form.Description.length}/300 ký tự`} error={errors.Description}>
          <textarea
            rows={3}
            value={form.Description}
            onChange={(event) => setForm({ ...form, Description: event.target.value })}
            className={input}
            maxLength={300}
          />
        </Field>
        <Field label="Trạng thái" hint="Danh mục tạm ẩn không xuất hiện trong biểu mẫu đăng tin và bộ lọc.">
          <select value={form.Status} onChange={(event) => setForm({ ...form, Status: event.target.value })} className={input}>
            <option value="ACTIVE">Đang dùng</option>
            <option value="INACTIVE">Tạm ẩn</option>
          </select>
        </Field>
      </form>
      <ConfirmDialog
        open={confirmDeactivate}
        title="Tạm ẩn danh mục?"
        message={`Danh mục đang có ${category?.ActiveListingCount ?? 0} tin hoạt động. Tin cũ vẫn hiển thị nhưng người bán không thể đăng tin mới vào danh mục này.`}
        confirmText="Tạm ẩn"
        tone="danger"
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirmDeactivate(false)}
      />
    </Modal>
  )
}

export default function AdminCategoriesPage() {
  const [filters, setFilters] = useState({ q: '', status: '', page: 1 })
  const [editing, setEditing] = useState(undefined) // undefined: đóng, null: thêm mới, object: sửa
  const { response, loading, error, reload } = useApi('/admin/categories', filters)
  const { data: conditions } = useApi('/categories/conditions')
  const update = (patch) => setFilters((current) => ({ ...current, page: 1, ...patch }))

  const columns = [
    { key: 'CategoryId', title: 'Mã', render: (row) => <span className="font-mono text-xs text-slate-500">#{row.CategoryId}</span> },
    {
      key: 'CategoryName',
      title: 'Danh mục',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.CategoryName}</p>
          {row.Description && <p className="max-w-md text-xs text-slate-500">{row.Description}</p>}
        </div>
      ),
    },
    { key: 'ListingCount', title: 'Tin đăng', render: (row) => `${row.ActiveListingCount} đang bán / ${row.ListingCount}`, className: 'whitespace-nowrap' },
    { key: 'Status', title: 'Trạng thái', render: (row) => <StatusBadge map={CATEGORY_STATUS} value={row.Status} /> },
    { key: 'CreatedAt', title: 'Ngày tạo', render: (row) => formatDate(row.CreatedAt) },
    {
      key: 'actions',
      title: '',
      render: (row) => (
        <button type="button" className={btn.ghost} onClick={() => setEditing(row)} aria-label={`Sửa ${row.CategoryName}`}>
          <Pencil size={15} /> Sửa
        </button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        code="B03"
        title="Quản lý danh mục"
        description="Danh mục hàng hóa và lựa chọn tình trạng dùng chung cho biểu mẫu đăng tin, tìm kiếm và bộ lọc. Thêm và sửa danh mục được ghi nhật ký."
        actions={
          <button type="button" className={btn.primary} onClick={() => setEditing(null)}>
            <Plus size={16} /> Thêm danh mục
          </button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <Card>
          <div className="p-4 pb-0">
            <FilterBar onReset={() => setFilters({ q: '', status: '', page: 1 })}>
              <SearchInput value={filters.q} onChange={(q) => update({ q })} placeholder="Tìm tên danh mục" />
              <Field className="w-40">
                <select value={filters.status} onChange={(event) => update({ status: event.target.value })} className={input} aria-label="Trạng thái">
                  <option value="">Mọi trạng thái</option>
                  <option value="ACTIVE">Đang dùng</option>
                  <option value="INACTIVE">Tạm ẩn</option>
                </select>
              </Field>
            </FilterBar>
          </div>
          <DataTable columns={columns} rows={response?.data} rowKey={(row) => row.CategoryId} loading={loading} error={error} onRetry={reload} />
          <Pagination pagination={response?.pagination} onPage={(page) => setFilters((current) => ({ ...current, page }))} />
        </Card>
        <Card className="h-fit p-4">
          <h2 className="text-sm font-semibold text-slate-900">Tình trạng sản phẩm dùng chung</h2>
          <p className="mt-1 text-xs text-slate-500">Các lựa chọn cố định trong biểu mẫu đăng tin và bộ lọc.</p>
          <ul className="mt-3 space-y-2">
            {conditions?.map((item) => (
              <li key={item.value} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="font-medium">{item.label} <span className="font-mono text-xs text-slate-400">{item.value}</span></p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {editing !== undefined && <CategoryForm category={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
    </>
  )
}
