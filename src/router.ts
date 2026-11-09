import { createRouter, createWebHashHistory } from "vue-router";
import { currentUser, restoreSession } from "./auth";
import ContentView from "./views/ContentView.vue";
import LoginView from "./views/LoginView.vue";
import NotFoundView from "./views/NotFoundView.vue";
import OverviewView from "./views/OverviewView.vue";
import PlanningView from "./views/PlanningView.vue";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "overview",
      component: OverviewView,
      meta: { requiresAuth: true },
    },
    {
      path: "/content",
      name: "content",
      component: ContentView,
      meta: { requiresAuth: true },
    },
    {
      path: "/planning",
      name: "planning",
      component: PlanningView,
      meta: { requiresAuth: true },
    },
    { path: "/login", name: "login", component: LoginView },
    { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
  ],
});

router.beforeEach(async (to, from) => {
  const shouldRestoreSession =
    to.meta.requiresAuth || (to.name === "login" && from.name === undefined);
  if (shouldRestoreSession) {
    if (
      !currentUser.value &&
      !(await restoreSession()) &&
      to.meta.requiresAuth
    ) {
      return { name: "login", query: { redirect: to.fullPath } };
    }
  }

  if (to.name === "login" && currentUser.value) {
    return { name: "overview" };
  }
});

export default router;
