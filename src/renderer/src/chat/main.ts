import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ChatApp from './ChatApp.vue'
import '../styles/tokens.css'

const app = createApp(ChatApp)
app.use(createPinia())
app.mount('#app')
