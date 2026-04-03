import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ruRU from 'antd/locale/ru_RU'
import 'antd/dist/reset.css'
import App from './App'
import './styles/custom-styles.css

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
