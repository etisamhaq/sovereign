import React, { Fragment, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon, UserCircleIcon, SunIcon, MoonIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { CpuChipIcon, UserGroupIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import CoinDisplay from './rewards/CoinDisplay';

const solutionItems = [
  {
    name: 'AI Automation Setup',
    description: 'Automate repetitive tasks with AI-powered workflows',
    href: '/solutions/automation',
    icon: CpuChipIcon,
  },
  {
    name: 'Custom AI Agents',
    description: 'Build intelligent agents tailored to your business',
    href: '/solutions/agents',
    icon: UserGroupIcon,
  },
  {
    name: 'Workflow Optimization',
    description: 'Streamline and optimize your existing processes',
    href: '/solutions/optimization',
    icon: ArrowPathIcon,
  },
];

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { darkMode, toggleDarkMode } = useTheme();
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  const navigation = [
    { name: 'Home', href: '/', auth: false, guestOnly: false },
    { name: 'Features', href: '/features', auth: false, guestOnly: false },
    { name: 'Try Free', href: '/try-tools', auth: false, guestOnly: true },
    { name: 'Solutions', href: '/solutions', auth: false, guestOnly: false, hasDropdown: true },
    { name: 'Workflows', href: '/workflows', auth: false, guestOnly: false },
    { name: 'Marketplace', href: '/marketplace', auth: false, guestOnly: false },
    { name: 'Tools', href: '/tools', auth: true, guestOnly: false },
    { name: 'Agents', href: '/agents', auth: true, guestOnly: false },
    { name: 'Chat', href: '/chat', auth: true, guestOnly: false },
    { name: 'Dashboard', href: '/dashboard', auth: true, guestOnly: false },
    { name: 'Library', href: '/history', auth: true, guestOnly: false },
    { name: 'Referrals', href: '/referrals', auth: true, guestOnly: false },
    { name: 'Community', href: '/community', auth: false, guestOnly: false },
    { name: 'Pricing', href: '/pricing', auth: false, guestOnly: false },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <Disclosure as="nav" className="bg-white shadow dark:bg-gray-800">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <Link to="/" className="flex flex-shrink-0 items-center">
                  <img
                    src="/logo.jpg"
                    alt="Sovereign"
                    className="h-8 w-8 rounded-md"
                  />
                  <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                    Sovereign
                  </span>
                </Link>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  {navigation
                    .filter((item) => (!item.auth || isAuthenticated) && !(item.guestOnly && isAuthenticated))
                    .map((item) => {
                      const isActive =
                        item.href === '/'
                          ? location.pathname === '/'
                          : location.pathname.startsWith(item.href);

                      if ((item as any).hasDropdown) {
                        return (
                          <div
                            key={item.name}
                            className="relative"
                            onMouseEnter={() => setSolutionsOpen(true)}
                            onMouseLeave={() => setSolutionsOpen(false)}
                          >
                            <button
                              className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors h-full ${
                                isActive
                                  ? 'border-primary-500 text-gray-900 dark:text-white'
                                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                              }`}
                            >
                              {item.name}
                              <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <Transition
                              show={solutionsOpen}
                              as={Fragment}
                              enter="transition ease-out duration-200"
                              enterFrom="opacity-0 translate-y-1"
                              enterTo="opacity-100 translate-y-0"
                              leave="transition ease-in duration-150"
                              leaveFrom="opacity-100 translate-y-0"
                              leaveTo="opacity-0 translate-y-1"
                            >
                              <div className="absolute left-1/2 z-20 mt-2 w-80 -translate-x-1/2 rounded-xl bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700">
                                <div className="p-2">
                                  {solutionItems.map((si) => (
                                    <Link
                                      key={si.href}
                                      to={si.href}
                                      className="flex items-start gap-3 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                      onClick={() => setSolutionsOpen(false)}
                                    >
                                      <si.icon className="h-6 w-6 flex-shrink-0 text-primary-600 dark:text-primary-400 mt-0.5" />
                                      <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{si.name}</p>
                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{si.description}</p>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            </Transition>
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          className={`inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium transition-colors ${
                            isActive
                              ? 'border-primary-500 text-gray-900 dark:text-white'
                              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white'
                          }`}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                {/* Dark Mode Toggle */}
                <button
                  onClick={toggleDarkMode}
                  className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  aria-label="Toggle dark mode"
                >
                  {darkMode ? (
                    <SunIcon className="h-5 w-5" />
                  ) : (
                    <MoonIcon className="h-5 w-5" />
                  )}
                </button>

                {/* Coin Display */}
                <div className="ml-2">
                  <CoinDisplay />
                </div>

                {isAuthenticated ? (
                  <Menu as="div" className="relative ml-3">
                    <div>
                      <Menu.Button className="flex rounded-full bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800">
                        <span className="sr-only">Open user menu</span>
                        {user?.avatar ? (
                          <img
                            className="h-8 w-8 rounded-full"
                            src={user.avatar}
                            alt={user.first_name}
                          />
                        ) : (
                          <UserCircleIcon className="h-8 w-8 text-gray-400" />
                        )}
                      </Menu.Button>
                    </div>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-700">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/profile"
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-600' : ''
                              } block px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                            >
                              Your Profile
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              to="/referrals"
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-600' : ''
                              } block px-4 py-2 text-sm text-gray-700 dark:text-gray-200`}
                            >
                              🎁 Refer a Friend
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={handleLogout}
                              className={`${
                                active ? 'bg-gray-100 dark:bg-gray-600' : ''
                              } block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200`}
                            >
                              Sign out
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                ) : (
                  <div className="flex items-center space-x-4">
                    <Link
                      to="/login"
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      className="btn btn-primary"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
              <div className="-mr-2 flex items-center sm:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden">
            <div className="space-y-1 pb-3 pt-2">
              {navigation
                .filter((item) => (!item.auth || isAuthenticated) && !(item.guestOnly && isAuthenticated))
                .map((item) => {
                  const isActive =
                    item.href === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.href);

                  if ((item as any).hasDropdown) {
                    return (
                      <div key={item.name}>
                        <div
                          className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium ${
                            isActive
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                              : 'border-transparent text-gray-500 dark:text-gray-300'
                          }`}
                        >
                          {item.name}
                        </div>
                        {solutionItems.map((si) => (
                          <Link
                            key={si.href}
                            to={si.href}
                            className="block border-l-4 border-transparent py-2 pl-8 pr-4 text-sm font-medium text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                          >
                            {si.name}
                          </Link>
                        ))}
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`block border-l-4 py-2 pl-3 pr-4 text-base font-medium transition-colors ${
                        isActive
                          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
            </div>
            <div className="border-t border-gray-200 pb-3 pt-4 dark:border-gray-700">
              {/* Dark Mode Toggle for Mobile */}
              <div className="px-4 pb-3 space-y-1">
                <button
                  onClick={toggleDarkMode}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white rounded-md"
                >
                  {darkMode ? (
                    <SunIcon className="h-5 w-5 mr-3" />
                  ) : (
                    <MoonIcon className="h-5 w-5 mr-3" />
                  )}
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                {/* Coin Display for Mobile */}
                {isAuthenticated && (
                  <div className="px-3 py-2">
                    <CoinDisplay />
                  </div>
                )}
              </div>
              {isAuthenticated ? (
                <>
                  <div className="flex items-center px-4">
                    <div className="flex-shrink-0">
                      {user?.avatar ? (
                        <img
                          className="h-10 w-10 rounded-full"
                          src={user.avatar}
                          alt={user.first_name}
                        />
                      ) : (
                        <UserCircleIcon className="h-10 w-10 text-gray-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-gray-800 dark:text-white">
                        {user?.first_name} {user?.last_name}
                      </div>
                      <div className="text-sm font-medium text-gray-500 dark:text-gray-300">
                        {user?.email}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      Your Profile
                    </Link>
                    <Link
                      to="/referrals"
                      className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      🎁 Refer a Friend
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full px-4 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-3 space-y-1">
                  <Link
                    to="/login"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="block px-4 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
};

export default Header;