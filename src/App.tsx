import { Routes, Route, Navigate } from 'react-router-dom'
import DeskRouter from './desk/DeskRouter'

function App() {
  return (
    <Routes>
      <Route path="/desk/*" element={<DeskRouter />} />
      <Route path="*" element={<Navigate to="/desk/login" replace />} />
    </Routes>
  )
}

export default App