/* -------------------------------------------------------------------------- */
/*                              Config                                      */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  isNavbarVerticalCollapsed: false,
  theme: 'dark',
  isRTL: false,
  isFluid: false,
  navbarStyle: 'transparent',
  navbarPosition: 'vertical'
};

Object.keys(CONFIG).forEach(key => {
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, CONFIG[key]);
  }
});

if (JSON.parse(localStorage.getItem('isNavbarVerticalCollapsed'))) {
  document.documentElement.classList.add('navbar-vertical-collapsed');
}

if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('dark');
}
