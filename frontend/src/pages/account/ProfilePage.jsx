
import { useRef, useState } from 'react'
import { Camera, LoaderCircle, Save, UserRound } from 'lucide-react'
import { toast } from 'react-toastify'
import { errorMessage } from '../../lib/api'
import { useDevAccount } from '../../hooks/useDevAccount'
import './ProfilePage.scss'
import {
  updateProfile,
  uploadProfileAvatar,
} from '../../services/profileApi'

// Regex kiểm tra họ tên tiếng Việt
// Cho phép chữ có dấu, khoảng trắng, dấu nháy và dấu gạch nối
const nameRegex =
  /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u

// Số điện thoại: đúng 10 chữ số, bắt đầu bằng 0
const phoneRegex = /^0\d{9}$/

// Địa chỉ: chữ, số và ký tự địa chỉ thông thường
const addressRegex =
  /^[\p{L}\p{M}\d\s,./#'-]+$/u

function ProfilePage() {
  const { me } = useDevAccount()

  if (!me) {
    return (
      <div className="profile-page profile-page--loading">
        <LoaderCircle className="profile-page__spinner" />
        <p className="profile-page__loading-text">Đang tải hồ sơ...</p>
      </div>
    )
  }

  return (
    <ProfileForm
      key={me.UserId || me.userId || me.id || me._id || me.Email || me.email}
      me={me}
    />
  )
}

function ProfileForm({ me }) {
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    fullName: me.FullName || me.fullName || me.name || '',
    phone: me.Phone || me.phone || '',
    address: me.Address || me.address || '',
  })

  const [avatar, setAvatar] = useState(
    me.AvatarUrl || me.avatarUrl || me.avatar || '',
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setForm((prev) => {
      return {
        ...prev,
        [name]: value,
      }
    })

    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }))
  }

  const validateForm = () => {
    const newErrors = {}

    const trimmedName = form.fullName.trim()
    const trimmedPhone = form.phone.trim()
    const trimmedAddress = form.address.trim()

    // Kiểm tra họ tên
    if (!trimmedName) {
      newErrors.fullName = 'Vui lòng nhập họ tên'
    } else if (trimmedName.length < 2) {
      newErrors.fullName = 'Họ tên phải có ít nhất 2 ký tự'
    } else if (trimmedName.length > 100) {
      newErrors.fullName = 'Họ tên không được vượt quá 100 ký tự'
    } else if (!nameRegex.test(trimmedName)) {
      newErrors.fullName =
        'Họ tên không được chứa số hoặc ký tự đặc biệt'
    }

    // Kiểm tra số điện thoại
    if (!trimmedPhone) {
      newErrors.phone = 'Vui lòng nhập số điện thoại'
    } else if (!phoneRegex.test(trimmedPhone)) {
      newErrors.phone =
        'Số điện thoại không đúng định dạng'
    }

    // Kiểm tra địa chỉ
    if (!trimmedAddress) {
      newErrors.address = 'Vui lòng nhập địa chỉ'
    } else if (trimmedAddress.length < 5) {
      newErrors.address = 'Địa chỉ phải có ít nhất 5 ký tự'
    } else if (trimmedAddress.length > 255) {
      newErrors.address =
        'Địa chỉ không được vượt quá 255 ký tự'
    } else if (!addressRegex.test(trimmedAddress)) {
      newErrors.address =
        'Địa chỉ chứa ký tự không hợp lệ'
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setForm((current) => ({
        ...current,
        fullName: newErrors.fullName ? '' : current.fullName,
        phone: newErrors.phone ? '' : current.phone,
        address: newErrors.address ? '' : current.address,
      }))
    }

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!validateForm()) return

    try {
      setSaving(true)

      const updatedUser = await updateProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      })

      setForm({
        fullName: updatedUser.FullName || form.fullName.trim(),
        phone: updatedUser.Phone || '',
        address: updatedUser.Address || '',
      })
      syncUpdatedUser(updatedUser)

      toast.success('Cập nhật hồ sơ thành công.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Ảnh đại diện chỉ nhận định dạng JPG hoặc PNG.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB.')
      event.target.value = ''
      return
    }

    try {
      setUploading(true)

      const avatarUrl = await uploadProfileAvatar(file)
      const updatedUser = await updateProfile({ avatarUrl })
      setAvatar(updatedUser.AvatarUrl || avatarUrl)
      syncUpdatedUser(updatedUser)

      toast.success('Cập nhật ảnh đại diện thành công.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const syncUpdatedUser = (updatedUser) => {
    window.localStorage.setItem('user', JSON.stringify(updatedUser))
    window.dispatchEvent(
      new CustomEvent('profile-updated', { detail: updatedUser }),
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-page__heading">
        <h1 className="profile-page__title">Hồ sơ cá nhân</h1>
        <p className="profile-page__description">
          Quản lý thông tin tài khoản của bạn
        </p>
      </div>

      <form
        className="profile-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="profile-avatar">
          <div className="profile-avatar__image">
            {avatar ? (
              <img src={avatar} alt="Ảnh đại diện" />
            ) : (
              <UserRound size={48} />
            )}
          </div>

          <div className="profile-avatar__details">
            <h3 className="profile-avatar__title">Ảnh đại diện</h3>
            <p className="profile-avatar__description">
              Chọn ảnh JPG hoặc PNG, tối đa 5MB.
            </p>

            <button
              type="button"
              className="profile-avatar__button"
              onClick={handleAvatarClick}
              disabled={uploading}
            >
              {uploading ? (
                <LoaderCircle className="profile-page__spinner" size={16} />
              ) : (
                <Camera size={16} />
              )}

              {uploading ? 'Đang tải ảnh...' : 'Chọn ảnh'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="profile-avatar__input"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        <div className="profile-fields">
          <div className="profile-field">
            <label className="profile-field__label" htmlFor="fullName">
              Họ và tên
            </label>

            <input
              id="fullName"
              name="fullName"
              type="text"
              value={form.fullName}
              onChange={handleFieldChange}
              autoComplete="name"
              maxLength={100}
              placeholder={errors.fullName || 'Nhập họ và tên'}
              className={`profile-input ${errors.fullName ? 'profile-input--error' : ''}`}
              aria-invalid={Boolean(errors.fullName)}
            />
          </div>

          <div className="profile-field">
            <label className="profile-field__label" htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              value={me.Email || me.email || ''}
              readOnly
              className="profile-input profile-input--readonly"
            />

            <span className="profile-field__note">
              Email không thể thay đổi.
            </span>
          </div>

          <div className="profile-field">
            <label className="profile-field__label" htmlFor="phone">
              Số điện thoại
            </label>

            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleFieldChange}
              autoComplete="tel"
              maxLength={10}
              placeholder={errors.phone || 'Nhập số điện thoại'}
              className={`profile-input ${errors.phone ? 'profile-input--error' : ''}`}
              aria-invalid={Boolean(errors.phone)}
            />
          </div>

          <div className="profile-field">
            <label className="profile-field__label" htmlFor="address">
              Địa chỉ
            </label>

            <input
              id="address"
              name="address"
              type="text"
              value={form.address}
              onChange={handleFieldChange}
              autoComplete="street-address"
              maxLength={255}
              placeholder={errors.address || 'Nhập địa chỉ'}
              className={`profile-input ${errors.address ? 'profile-input--error' : ''}`}
              aria-invalid={Boolean(errors.address)}
            />
          </div>
        </div>

        <div className="profile-form__actions">
          <button
            type="submit"
            className="profile-save-button"
            disabled={saving}
          >
            {saving ? (
              <LoaderCircle className="profile-page__spinner" size={18} />
            ) : (
              <Save size={18} />
            )}

            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProfilePage
