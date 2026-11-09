import { createRouter, createWebHashHistory } from "vue-router";
import { currentUser, restoreSession } from "./auth";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import OverviewView from "./views/OverviewView.vue";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "overview",
      component: OverviewView,
      meta: { requiresAuth: true },
    },
    { path: "/login", name: "login", component: LoginView },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
  ],
});

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    if (!currentUser.value && !(await restoreSession())) {
      return { name: "login", query: { redirect: to.fullPath } };
    }
  }

  if (to.name === "login" && currentUser.value) {
    return { name: "overview" };
  }
});

export default router;
