import api from '../lib/api'

export async function updateProfile(profile) {
  const { data } = await api.patch('/me', profile)
  if (data?.success !== true || !data.data) {
    throw new Error(data?.message || 'Không nhận được hồ sơ đã cập nhật.')
  }
  return data.data
}

export async function uploadProfileAvatar(file) {
  const { data } = await api.post('/uploads', file, {
    headers: { 'Content-Type': file.type },
  })
  const url = data?.data?.url
  if (data?.success !== true || typeof url !== 'string' || !url.startsWith('/api/v1/uploads/')) {
    throw new Error(data?.message || 'Không nhận được địa chỉ ảnh đã tải lên.')
  }
  return url
}
