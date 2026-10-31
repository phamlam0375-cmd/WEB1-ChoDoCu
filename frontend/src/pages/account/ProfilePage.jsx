import { useEffect, useRef, useState } from 'react'
import { Camera, LoaderCircle, Save, UserRound } from 'lucide-react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../lib/api'
import { useDevAccount } from '../../hooks/useDevAccount'
import { updateProfile, uploadProfileAvatar } from '../../services/profileApi'

const inputClass = 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10'

export default function ProfilePage() {
  const { me } = useDevAccount()
  const fileInput = useRef(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', address: '' })
  const [avatarUrl, setAvatarUrl] = useState('')
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!me) return
    setForm({
      fullName: me.FullName || '',
      email: me.Email || '',
      phone: me.Phone || '',
      address: me.Address || '',
    })
    setAvatarUrl(me.AvatarUrl || '')
    setAvatarFile(null)
    setAvatarPreview('')
  }, [me])

  useEffect(() => {
    if (!avatarFile) return undefined
    const previewUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [avatarFile])

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Ảnh đại diện chỉ nhận định dạng JPG hoặc PNG.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh đại diện không được vượt quá 5MB.')
      return
    }
    setAvatarFile(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    setSaving(true)
    try {
      const profileUpdate = {
        fullName: form.fullName,
        phone: form.phone,
        address: form.address,
      }
      if (avatarFile) profileUpdate.avatarUrl = await uploadProfileAvatar(avatarFile)
      const updatedUser = await updateProfile(profileUpdate)
      window.localStorage.setItem('user', JSON.stringify(updatedUser))
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: updatedUser }))
      setForm({
        fullName: updatedUser.FullName || '',
        email: updatedUser.Email || '',
        phone: updatedUser.Phone || '',
        address: updatedUser.Address || '',
      })
      setAvatarUrl(updatedUser.AvatarUrl || '')
      setAvatarFile(null)
      toast.success('Đã cập nhật hồ sơ.')
    } catch (error) {
      toast.error(errorMessage(error, error.message || 'Không thể cập nhật hồ sơ.'))
    } finally {
      setSaving(false)
    }
  }

  const currentAvatar = avatarPreview || avatarUrl

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="mb-7">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-emerald-600">Tài khoản</p>
        <h1 className="mt-1 text-2xl font-extrabold text-slate-900">Thông tin cá nhân</h1>
        <p className="mt-1 text-sm text-slate-500">Cập nhật thông tin hiển thị trên tài khoản của bạn.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-slate-50 p-5 sm:flex-row">
          <div className="relative grid size-28 shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-emerald-700 ring-4 ring-white">
            {currentAvatar ? (
              <img src={currentAvatar} alt="Ảnh đại diện" className="size-full object-cover" />
            ) : (
              <UserRound size={48} strokeWidth={1.5} />
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="font-bold text-slate-800">Ảnh đại diện</h2>
            <p className="mt-1 text-sm text-slate-500">Chọn ảnh JPG hoặc PNG, tối đa 5MB.</p>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={handleAvatarChange}
              aria-label="Chọn ảnh đại diện"
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
            >
              <Camera size={16} />
              Thay ảnh
            </button>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Họ và tên
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleFieldChange}
              autoComplete="name"
              maxLength={100}
              required
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Email
            <input
              type="email"
              value={form.email}
              readOnly
              aria-describedby="profile-email-note"
              className={`${inputClass} cursor-not-allowed bg-slate-50 text-slate-500`}
            />
            <span id="profile-email-note" className="mt-1 block text-xs font-normal text-slate-500">Email không thể thay đổi tại đây.</span>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Số điện thoại
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleFieldChange}
              autoComplete="tel"
              maxLength={16}
              pattern="(\+84|0)[0-9]{8,11}"
              placeholder="Ví dụ: 0901234567"
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Địa chỉ
            <input
              name="address"
              value={form.address}
              onChange={handleFieldChange}
              autoComplete="street-address"
              maxLength={255}
              placeholder="Nhập địa chỉ của bạn"
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? <LoaderCircle size={17} className="animate-spin" /> : <Save size={17} />}
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </section>
  )
}
