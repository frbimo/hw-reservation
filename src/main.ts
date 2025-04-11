// src/main.ts
import { createApp } from 'vue';
// import './style.css' // Can remove this if not using it
import './index.css'; // Ensure Tailwind CSS is imported
import App from './App.vue';
import './assets/calendar-styles.css'; // <-- Add this line
import router from './router';
const app = createApp(App);
app.use(router); // Register the router
app.mount('#app');
