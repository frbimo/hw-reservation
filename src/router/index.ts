import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import AppScheduler from '../components/AppScheduler.vue';

const routes = [
    { path: '/', redirect: { name: 'Login' } },
    { path: '/login', name: 'Login', component: LoginView },
    { path: '/scheduler', name: 'Scheduler', component: AppScheduler },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});


// Navigation guard to check if the user is logged in
router.beforeEach((to, _from, next) => {
    const isLoggedIn = !!localStorage.getItem('currentUser');
    if (to.name !== 'Login' && !isLoggedIn) {
        next({ name: 'Login', query: { redirect: to.fullPath } });
    } else {
        next();
    }
});

export default router;


