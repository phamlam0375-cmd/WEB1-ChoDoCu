import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Card, ErrorState, Loading, PageHeader } from '../components/admin/AdminUi'
import { btn } from '../components/admin/styles'
import { errorMessage } from '../lib/api'
import { formatMoney } from '../lib/format'
import { createSePayCheckout, getSePayStatus, listCreditPackages } from '../services/creditApi'

const INVOICE_KEY = 'choDoCu.pendingCreditInvoice'

export default function CreditPackagesPage() {
  const [params] = useSearchParams()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    listCreditPackages().then(data => {
      if (active) setPackages(data)
    }).catch(requestError => {
      if (active) setError(errorMessage(requestError))
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (params.get('payment') !== 'success') return undefined
    const invoice = sessionStorage.getItem(INVOICE_KEY)
    if (!invoice) return undefined
    let active = true
    const check = async () => {
      try {
        const transaction = await getSePayStatus(invoice)
        if (active && transaction.Status === 'SUCCESS') {
          setNotice('Thanh toán thành công. Credit đã được cộng vào tài khoản.')
          sessionStorage.removeItem(INVOICE_KEY)
          window.dispatchEvent(new Event('credit-balance-updated'))
        }
      } catch (requestError) {
        if (active) setError(errorMessage(requestError))
      }
    }
    check()
    return () => { active = false }
  }, [params])

  const pay = async creditPackage => {
    setBusy(creditPackage.PackageId)
    setError('')
    try {
      const checkout = await createSePayCheckout(creditPackage.PackageId)
      sessionStorage.setItem(INVOICE_KEY, checkout.invoice)
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = checkout.checkoutUrl
      Object.entries(checkout.fields).forEach(([name, value]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = String(value ?? '')
        form.appendChild(input)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (requestError) {
      setError(errorMessage(requestError))
      setBusy(null)
    }
  }

  return <main className="w-full text-slate-900">
      <PageHeader title="Mua gói Credit" description="Chọn gói phù hợp và thanh toán an toàn qua SePay." />
      {notice && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-800"><CheckCircle2 className="mr-2 inline" size={18} />{notice}</p>}
      {error ? <ErrorState message={error} onRetry={() => window.location.reload()} /> : loading ? <Loading /> : <div className="grid gap-5 md:grid-cols-3">
        {packages.map(creditPackage => <Card key={creditPackage.PackageId} className={`relative flex flex-col p-5 ${creditPackage.IsFeatured ? 'border-emerald-400 ring-2 ring-emerald-100' : ''}`}>
          {creditPackage.IsFeatured && <span className="absolute right-4 top-4 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Phổ biến</span>}
          <CreditCard className="text-emerald-600" size={28} />
          <h2 className="mt-4 text-lg font-bold">{creditPackage.PackageName}</h2>
          <p className="mt-2 min-h-10 text-sm text-slate-500">{creditPackage.Description || 'Gói credit cho nhu cầu quảng bá sản phẩm.'}</p>
          <p className="mt-5 text-3xl font-bold text-emerald-700">{Number(creditPackage.TotalCredit).toLocaleString('vi-VN')} credit</p>
          <p className="mt-1 text-sm text-slate-500">Giá {formatMoney(creditPackage.Price)}</p>
          <button type="button" className={`${btn.primary} mt-6 w-full`} disabled={busy !== null} onClick={() => pay(creditPackage)}>
            {busy === creditPackage.PackageId ? <><Loader2 size={16} className="animate-spin" /> Đang chuyển sang SePay…</> : 'Thanh toán qua SePay'}
          </button>
        </Card>)}
      </div>}
    </main>
}
