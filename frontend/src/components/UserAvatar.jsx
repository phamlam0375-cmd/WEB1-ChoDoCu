const getUserInitials = (user) => {
  const fullName = user?.FullName || user?.fullName || user?.Username || user?.username || ''

  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('vi-VN') || 'U'
}

export default function UserAvatar({ user, className = 'size-10' }) {
  const avatarUrl = user?.AvatarUrl || user?.avatarUrl || user?.avatar

  return (
    <span className={`relative grid ${className} shrink-0 place-items-center overflow-hidden rounded-full bg-emerald-100 text-sm font-bold text-emerald-800`}>
      {getUserInitials(user)}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none'
          }}
        />
      )}
    </span>
  )
}
