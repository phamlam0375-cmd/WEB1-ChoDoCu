import './App.css'

function App() {
  return (
    <main id="center">
      <span className="counter">Website Chợ Đồ Cũ</span>
      <h1>Demo CI/CD thành công</h1>
      <p>Giao diện này được kiểm tra bởi CI và triển khai tự động bằng Docker.</p>
      <code>feature branch → master → CI → CD → Docker</code>
    </main>
  )
}

export default App
