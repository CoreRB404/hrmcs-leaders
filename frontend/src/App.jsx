import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import './styles.css';
import Card from './components/Card';
import Sidebar from './components/Sidebar';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import AccessAccountPanel from './components/AccessAccountPanel';
import LandingPage from './components/LandingPage';
import DashboardSummary from './components/DashboardSummary';
import HospitalDirectory from './components/HospitalDirectory';
import NotificationsPanel from './components/NotificationsPanel';
import NetworkAvailability from './components/NetworkAvailability';
import ResourceActions from './components/ResourceActions';
import HospitalDashboard from './components/HospitalDashboard';
import RequestFiltersPanel from './components/RequestFiltersPanel';
import ResourceRequestList from './components/ResourceRequestList';
import AdminOversightPanel from './components/AdminOversightPanel';
import AdminQuickActionsPanel from './components/AdminQuickActionsPanel';
import ManageAccountsPanel from './components/ManageAccountsPanel';
import CriticalShortagesPanel from './components/CriticalShortagesPanel';
import AiRecommendationsPanel from './components/AiRecommendationsPanel';
import Toast from './components/Toast';

function App() {
  const defaultDashboard = {
    totalHospitals: 0,
    totalInventoryItems: 0,
    criticalShortages: [],
    pendingRequests: 0,
    emergencyAlerts: 0,
  };
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [adminSummary, setAdminSummary] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');
  const [requestTypeFilter, setRequestTypeFilter] = useState('All');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [recommendationMap, setRecommendationMap] = useState({ nodes: [], edges: [], currentHospitalId: null });
  const [networkInventory, setNetworkInventory] = useState([]);
  const [networkSearch, setNetworkSearch] = useState('');
  const [inventorySort, setInventorySort] = useState('quantity');
  const [inventoryAvailabilityFilter, setInventoryAvailabilityFilter] = useState('All');
  const [selectedSupplyId, setSelectedSupplyId] = useState(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [hospitalDashboard, setHospitalDashboard] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('hrmcs-token') || '');
  const [currentHospital, setCurrentHospital] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hrmcs-hospital') || 'null');
    } catch (error) {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ email: 'admin@hrmcs.org', password: 'Admin@1234' });
  const [listingForm, setListingForm] = useState({ resourceType: 'Supply', resourceName: '', quantity: 10, availableForBorrow: true, availableForOrder: true });
  const [requestForm, setRequestForm] = useState({ providerHospitalId: '', resourceName: '', quantity: 5, requestType: 'Borrow', urgency: 'High', notes: '' });
  const [pendingHospitals, setPendingHospitals] = useState([]);
  const [reviewerAccounts, setReviewerAccounts] = useState([]);
  const [registerForm, setRegisterForm] = useState({ name: '', location: '', email: '', password: '', visibility: 'Public', type: 'General', emergencyStatus: 'Medium' });
  const [generatedReviewerCredentials, setGeneratedReviewerCredentials] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [adminRequestStatusFilter, setAdminRequestStatusFilter] = useState('All');
  const [networkLocationFilter, setNetworkLocationFilter] = useState('All');
  const [networkTypeFilter, setNetworkTypeFilter] = useState('All');
  const [timelineOpenId, setTimelineOpenId] = useState(null);
  const [activeAdminSection, setActiveAdminSection] = useState(() => {
    const saved = localStorage.getItem('hrmcs-active-section');
    if (saved) return saved;
    const stored = JSON.parse(localStorage.getItem('hrmcs-hospital') || 'null');
    return stored?.role === 'Admin' ? 'system-dashboard' : (stored ? 'hospital-dashboard' : 'system-dashboard');
  });

  const location = useLocation();
  const navigate = useNavigate();

  const sectionToPath = {
    'system-dashboard': '/system-dashboard',
    'hospital-directory': '/hospital-directory',
    'network-availability': '/network-availability',
    'admin-oversight': '/admin-oversight',
    'admin-manage-accounts': '/admin-manage-accounts',
    'ai-recommendations': '/ai-recommendations',
    'admin-quick-actions': '/admin-quick-actions',
    'access-account': '/access-account',
    'hospital-dashboard': '/hospital-dashboard',
    'resource-actions': '/resource-actions',
  };

  const pathToSection = Object.keys(sectionToPath).reduce((acc, sectionId) => {
    acc[sectionToPath[sectionId]] = sectionId;
    return acc;
  }, {});

  const getDefaultSection = () => {
    if (currentHospital?.role === 'Admin') return 'system-dashboard';
    if (isHospitalRole || isReviewerRole) return 'hospital-dashboard';
    return 'network-availability';
  };

  const handleSectionChange = (sectionId) => {
    if (!sectionId) return;
    setActiveAdminSection(sectionId);
    const targetPath = sectionToPath[sectionId] || '/';
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  };

  useEffect(() => {
    const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
    const sectionId = pathToSection[normalizedPath];

    if (!currentHospital) {
      if (normalizedPath !== '/login') {
        setActiveAdminSection('access-account');
        navigate('/login', { replace: true });
      }
      return;
    }

    if (sectionId) {
      if (sectionId !== activeAdminSection) {
        setActiveAdminSection(sectionId);
      }
    } else {
      const defaultSection = getDefaultSection();
      navigate(sectionToPath[defaultSection] || '/system-dashboard', { replace: true });
    }
  }, [location.pathname, currentHospital, activeAdminSection, navigate]);

  useEffect(() => {
    if (!currentHospital || location.pathname === '/login') return;
    if (activeAdminSection) {
      localStorage.setItem('hrmcs-active-section', activeAdminSection);
    }
  }, [activeAdminSection, currentHospital, location.pathname]);

  useEffect(() => {
    const hasToken = Boolean(token);
    const hasHospital = Boolean(currentHospital && currentHospital.id);
    if (!hasToken || !hasHospital) {
      localStorage.removeItem('hrmcs-token');
      localStorage.removeItem('hrmcs-hospital');
      localStorage.removeItem('hrmcs-active-section');
      localStorage.removeItem('hrmcs-parent-session');
      if (token || currentHospital) {
        setToken('');
        setCurrentHospital(null);
      }
    }
  }, [token, currentHospital]);

  const clearSession = (showMessage = true) => {
    localStorage.removeItem('hrmcs-token');
    localStorage.removeItem('hrmcs-hospital');
    localStorage.removeItem('hrmcs-active-section');
    localStorage.removeItem('hrmcs-parent-session');
    setToken('');
    setCurrentHospital(null);
    setActiveAdminSection('access-account');
    setDashboard(defaultDashboard);
    if (showMessage && location.pathname !== '/login') {
      setFeedback({ type: 'error', message: 'Session expired or invalid. Please sign in again.' });
    }
    navigate('/login', { replace: true });
  };

  const authFetch = async (url, options = {}) => {
    const { preserveSessionOn401 = false, ...fetchOptions } = options;
    const headers = { ...(fetchOptions.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const response = await fetch(url, { ...fetchOptions, headers });
    if (response.status === 401 && !preserveSessionOn401) {
      clearSession(false);
    }
    return response;
  };

  useEffect(() => {
    if (!token || !currentHospital || location.pathname === '/login') return;

    const verifySession = async () => {
      try {
        const response = await authFetch('/api/dashboard');
        if (response.status === 401) {
          clearSession(false);
        }
      } catch (error) {
        clearSession(false);
      }
    };

    verifySession();
  }, [token, currentHospital, location.pathname]);

  const getHospitalName = (hospitalId) => hospitals.find((hospital) => hospital.id === hospitalId)?.name || hospitalId;

  const selectedNetworkItem = networkInventory.find((item) => item.id === selectedSupplyId);
  const requestableInventory = networkInventory.filter((item) => {
    const available = Number(item.availableQuantity ?? item.quantity ?? 0);
    const supportsRequestType = requestForm.requestType === 'Order' ? item.availableForOrder : item.availableForBorrow;
    return item.hospitalId !== currentHospital?.id && available > 0 && supportsRequestType;
  });
  const requestableProviderIds = new Set(requestableInventory.map((item) => item.hospitalId));
  const activeProviders = hospitals.filter((hospital) => hospital.id !== currentHospital?.id
    && hospital.accountStatus === 'Active'
    && hospital.role === 'Hospital'
    && requestableProviderIds.has(hospital.id));
  const providerPublishedSupplies = Object.values(requestableInventory
    .filter((item) => item.hospitalId === requestForm.providerHospitalId)
    .reduce((supplies, item) => {
      const key = String(item.resourceName || '').trim().toLowerCase();
      const available = Number(item.availableQuantity ?? item.quantity ?? 0);
      if (!supplies[key]) supplies[key] = { resourceName: item.resourceName, availableQuantity: 0 };
      supplies[key].availableQuantity += available;
      return supplies;
    }, {}));
  const selectedPublishedSupply = providerPublishedSupplies.find((item) => item.resourceName === requestForm.resourceName);
  const selectedProvider = hospitals.find((hospital) => hospital.id === requestForm.providerHospitalId);
  const isRequestSubmitDisabled = !requestForm.providerHospitalId
    || !selectedPublishedSupply
    || requestForm.quantity <= 0
    || requestForm.quantity > selectedPublishedSupply.availableQuantity;
  const filteredRequests = requests
    .filter((request) => {
      if (!requestStatusFilter || requestStatusFilter === 'All') return true;
      return request.status === requestStatusFilter;
    })
    .filter((request) => {
      if (!requestTypeFilter || requestTypeFilter === 'All') return true;
      return (request.requestType || request.type) === requestTypeFilter;
    });
  const pendingProviderRequests = requests.filter((request) => request.status === 'Pending'
    && request.pharmacistApproval === 'Approved'
    && request.doctorApproval === 'Approved'
    && request.providerApproval === 'Pending');
  const adminVisibleRequests = requests.filter((request) => {
    if (!adminRequestStatusFilter || adminRequestStatusFilter === 'All') return true;
    return request.status === adminRequestStatusFilter;
  });

  const adminSummaryResolved = adminSummary || {
    totalHospitals: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    pendingProviderApprovals: 0,
    pendingAdminApprovals: 0,
    pendingHospitalApprovals: 0,
    latestNotifications: [],
  };

  const isAdmin = currentHospital?.role === 'Admin';
  const isReviewerRole = ['Doctor', 'Pharmacist'].includes(currentHospital?.role);
  const isHospitalAccount = Boolean(currentHospital);
  const isHospitalRole = Boolean(currentHospital && currentHospital.role === 'Hospital');
  const showFocusedSection = (sectionId) => !isHospitalAccount || activeAdminSection === sectionId;
  const hospitalWorkspaceStats = isHospitalRole ? [
    { label: 'Inventory items', value: hospitalDashboard?.hospitalInventory?.length ?? 0, tone: 'primary' },
    { label: 'Open requests', value: hospitalDashboard?.hospitalRequests?.filter((request) => request.status === 'Pending' || request.providerApproval === 'Pending').length ?? 0, tone: 'accent' },
    { label: 'At-risk items', value: hospitalDashboard?.hospitalInventory?.filter((item) => (item.availableQuantity ?? item.quantity) <= 5).length ?? 0, tone: 'warning' },
  ] : [];
  const sidebarSections = isAdmin
    ? [
        { id: 'system-dashboard', label: 'System dashboard', hint: 'Overview', icon: '◫' },
        { id: 'hospital-directory', label: 'Hospital directory', hint: 'Directory', icon: '◉' },
        { id: 'network-availability', label: 'Network availability', hint: 'Supply view', icon: '⬢' },
        { id: 'admin-oversight', label: 'Admin oversight', hint: 'Operations', icon: '▣' },
        { id: 'admin-manage-accounts', label: 'Manage accounts', hint: 'Hospital access control', icon: '✎' },
        { id: 'ai-recommendations', label: 'AI recommendations', hint: 'Smart suggestions', icon: '◌' },
        { id: 'admin-quick-actions', label: 'Admin quick actions', hint: 'Fast tasks', icon: '⚙' },
      ]
    : [
        ...((isHospitalRole || isReviewerRole) ? [{ id: 'hospital-dashboard', label: 'My dashboard', hint: 'Inventory & requests', icon: '◫' }] : []),
        { id: 'network-availability', label: 'Network availability', hint: 'Supply view', icon: '⬢' },
        { id: 'resource-actions', label: 'Resource actions', hint: 'Listings & requests', icon: '⤴' },
        { id: 'ai-recommendations', label: 'AI recommendations', hint: 'Smart suggestions', icon: '◌' },
        ...(isHospitalRole ? [{ id: 'access-account', label: 'Reviewer access', hint: 'Doctor / Pharmacist', icon: '⟡' }] : []),
      ];

  const selectSupply = (item) => {
    const availableQuantity = Number(item.availableQuantity ?? item.quantity ?? 0);
    const requestType = item.availableForBorrow ? 'Borrow' : 'Order';
    setSelectedSupplyId(item.id);
    setSelectedProviderId(item.hospitalId);
    setRequestForm({
      ...requestForm,
      providerHospitalId: item.hospitalId,
      resourceName: item.resourceName,
      quantity: Math.min(Math.max(1, Number(requestForm.quantity) || 1), availableQuantity),
      requestType,
    });
    setActiveAdminSection('resource-actions');
    setFeedback({ type: 'success', message: `Prefilled request for ${item.resourceName}. Please review and send.` });
  };

  const filterNetworkInventory = () => {
    const currentHospitalId = currentHospital?.id;
    return networkInventory
      .filter((item) => !currentHospitalId || item.hospitalId !== currentHospitalId)
      .filter((item) => {
        const query = networkSearch.toLowerCase();
        const provider = hospitals.find((hospital) => hospital.id === item.hospitalId);
        return !query || [item.resourceName, item.resourceType, getHospitalName(item.hospitalId), provider?.location, provider?.type].join(' ').toLowerCase().includes(query);
      })
      .filter((item) => {
        if (networkLocationFilter !== 'All') {
          const provider = hospitals.find((hospital) => hospital.id === item.hospitalId);
          if (!provider || provider.location !== networkLocationFilter) return false;
        }
        if (networkTypeFilter !== 'All') {
          const provider = hospitals.find((hospital) => hospital.id === item.hospitalId);
          if (!provider || provider.type !== networkTypeFilter) return false;
        }
        if (inventoryAvailabilityFilter === 'All') return true;
        if (inventoryAvailabilityFilter === 'Borrow') return item.availableForBorrow;
        if (inventoryAvailabilityFilter === 'Order') return item.availableForOrder;
        return true;
      })
      .sort((a, b) => {
        if (inventorySort === 'name') {
          return a.resourceName.localeCompare(b.resourceName);
        }
        const aQuantity = a.availableQuantity ?? a.quantity ?? a.publishedQuantity;
        const bQuantity = b.availableQuantity ?? b.quantity ?? b.publishedQuantity;
        return bQuantity - aQuantity;
      });
  };

  const loadData = async () => {
    try {
      const inventoryRes = await authFetch('/api/inventory');
      const inventoryData = inventoryRes.ok ? await inventoryRes.json() : [];
      const recommendationResource = requestForm.resourceName || '';
      const recommendationQuantity = Number(requestForm.quantity) || 10;
      const recommendationUrgency = requestForm.urgency || 'High';
      const recommendationRequesterId = currentHospital?.hospitalId || currentHospital?.id || '';
      const recommendationRequest = authFetch(
        `/api/recommendations${recommendationResource ? `/${encodeURIComponent(recommendationResource)}` : ''}?currentHospitalId=${encodeURIComponent(recommendationRequesterId)}&quantity=${recommendationQuantity}&urgency=${encodeURIComponent(recommendationUrgency)}`
      );
      const recommendationMapRequest = authFetch(`/api/recommendations/network/map?currentHospitalId=${encodeURIComponent(recommendationRequesterId)}`);

      const [dashboardRes, requestsRes, hospitalsRes, notificationsRes, recommendationsRes, recommendationMapRes] = await Promise.all([
        authFetch('/api/dashboard'),
        authFetch('/api/requests'),
        authFetch(`/api/hospitals?search=${encodeURIComponent(hospitalSearch)}`),
        authFetch('/api/notifications'),
        recommendationRequest,
        recommendationMapRequest,
      ]);

      const inventoryPayload = inventoryRes.ok
        ? inventoryData.map((item) => ({
            ...item,
            publishedQuantity: item.publishedQuantity ?? item.availableQuantity ?? item.quantity ?? 0,
            availableQuantity: item.availableQuantity ?? item.publishedQuantity ?? item.quantity ?? 0,
            quantity: item.quantity ?? item.publishedQuantity ?? item.availableQuantity ?? 0,
          }))
        : [];

      if (dashboardRes.ok) {
        setDashboard(await dashboardRes.json());
      }

      if (requestsRes.ok) {
        setRequests(await requestsRes.json());
      }

      if (hospitalsRes.ok) {
        setHospitals(await hospitalsRes.json());
      }

      if (notificationsRes.ok) {
        setNotifications(await notificationsRes.json());
      }

      if (inventoryRes.ok) {
        setNetworkInventory(inventoryPayload);
      }

      setRecommendationsLoading(true);
      if (recommendationsRes.ok) {
        const serverRecommendations = await recommendationsRes.json();
        setRecommendations(serverRecommendations?.length ? serverRecommendations : []);
        setRecommendationsError('');
      } else {
        setRecommendations([]);
        setRecommendationsError('Unable to load AI recommendations right now.');
      }
      setRecommendationsLoading(false);
      if (recommendationMapRes.ok) {
        setRecommendationMap(await recommendationMapRes.json());
      }

      if (token && currentHospital) {
        const workspaceHospitalId = currentHospital.hospitalId || currentHospital.id;
        const hospitalRes = await authFetch(`/api/hospital-dashboard/${workspaceHospitalId}`);
        if (hospitalRes.ok) {
          setHospitalDashboard(await hospitalRes.json());
        }
      }

      if (token && ['Hospital', 'Admin'].includes(currentHospital?.role)) {
        const reviewersRes = await authFetch('/api/hospitals/reviewers');
        setReviewerAccounts(reviewersRes.ok ? await reviewersRes.json() : []);
      } else {
        setReviewerAccounts([]);
      }

      if (token && currentHospital?.role === 'Admin') {
        const adminRes = await authFetch('/api/admin-summary');
        if (adminRes.ok) {
          setAdminSummary(await adminRes.json());
        }

        const pendingRes = await authFetch('/api/hospitals/pending');
        if (pendingRes.ok) {
          setPendingHospitals(await pendingRes.json());
        }
      } else {
        setPendingHospitals([]);
      }
    } catch (error) {
      console.error(error);
    }
  };



  useEffect(() => {
    if (!token || !currentHospital) return;
    loadData();
  }, [token, currentHospital, hospitalSearch, requestForm.resourceName, requestForm.quantity, requestForm.urgency]);

  const approve = async (id) => {
    const response = await authFetch(`/api/requests/${id}/approve`, { method: 'POST' });
    const result = await response.json();
    if (response.ok) {
      setRequests((prev) => prev.map((request) => request.id === id ? { ...request, status: 'Approved', providerApproval: 'Approved' } : request));
      setFeedback({ type: 'success', message: 'Request approved and recorded.' });
      await loadData();
    } else {
      setFeedback({ type: 'error', message: result.error || 'Approval failed.' });
    }
  };

  const reviewAdminRequest = async (id, decision) => {
    const response = await authFetch(`/api/requests/${id}/admin-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes: `${decision} by system admin` }),
    });
    const result = await response.json();
    if (response.ok) {
      setFeedback({ type: 'success', message: `Admin ${decision} recorded for request ${id}.` });
      await loadData();
    } else {
      setFeedback({ type: 'error', message: result.error || 'Admin review failed.' });
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });

    const result = await response.json();
    if (response.ok) {
      localStorage.removeItem('hrmcs-parent-session');
      setToken(result.token);
      setCurrentHospital(result.hospital);
      localStorage.setItem('hrmcs-token', result.token);
      localStorage.setItem('hrmcs-hospital', JSON.stringify(result.hospital));
      const defaultSection = result.hospital.role === 'Admin'
        ? 'system-dashboard'
        : ['Doctor', 'Pharmacist'].includes(result.hospital.role)
          ? 'hospital-dashboard'
          : 'hospital-dashboard';
      setActiveAdminSection(defaultSection);
      localStorage.setItem('hrmcs-active-section', defaultSection);
      navigate(sectionToPath[defaultSection] || '/');
      setFeedback({ type: 'success', message: `Welcome back, ${result.hospital.name}.` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Login failed.' });
    }
  };

  const handleReviewerLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await authFetch('/api/auth/reviewer-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
        preserveSessionOn401: true,
      });
      const result = await response.json().catch(() => ({
        error: response.status === 404
          ? 'Reviewer authentication route is unavailable. Restart the backend server.'
          : 'The authentication server returned an invalid response.',
      }));

      if (response.ok && result.token && result.hospital) {
        if (currentHospital?.role === 'Hospital' && token) {
          localStorage.setItem('hrmcs-parent-session', JSON.stringify({ token, hospital: currentHospital }));
        }
        setToken(result.token);
        setCurrentHospital(result.hospital);
        localStorage.setItem('hrmcs-token', result.token);
        localStorage.setItem('hrmcs-hospital', JSON.stringify(result.hospital));
        setActiveAdminSection('hospital-dashboard');
        localStorage.setItem('hrmcs-active-section', 'hospital-dashboard');
        navigate('/hospital-dashboard');
        setFeedback({ type: 'success', message: `${result.hospital.role} reviewer access granted.` });
      } else {
        setFeedback({ type: 'error', message: result.error || 'Reviewer login failed.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Unable to reach the authentication server. Please try again.' });
    }
  };

  const updateReviewerAccount = async (reviewerId, updates) => {
    const response = await authFetch(`/api/hospitals/reviewers/${reviewerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (response.ok) {
      setReviewerAccounts((accounts) => accounts.map((account) => account.id === reviewerId ? { ...account, ...result.reviewer } : account));
      setFeedback({ type: 'success', message: `${result.reviewer.role} account updated.` });
      return true;
    }
    setFeedback({ type: 'error', message: result.error || 'Reviewer account update failed.' });
    return false;
  };

  const changeOwnPassword = async (passwords) => {
    const response = await authFetch('/api/auth/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(passwords),
      preserveSessionOn401: true,
    });
    const result = await response.json();
    setFeedback({
      type: response.ok ? 'success' : 'error',
      message: response.ok ? 'Password changed successfully.' : result.error || 'Password change failed.',
    });
    return response.ok;
  };

  const handleLogout = () => {
    if (['Doctor', 'Pharmacist'].includes(currentHospital?.role)) {
      try {
        const parentSession = JSON.parse(localStorage.getItem('hrmcs-parent-session') || 'null');
        const belongsToParent = parentSession?.hospital?.role === 'Hospital'
          && parentSession.hospital.id === currentHospital.hospitalId;
        if (parentSession?.token && belongsToParent) {
          localStorage.setItem('hrmcs-token', parentSession.token);
          localStorage.setItem('hrmcs-hospital', JSON.stringify(parentSession.hospital));
          localStorage.setItem('hrmcs-active-section', 'hospital-dashboard');
          localStorage.removeItem('hrmcs-parent-session');
          setToken(parentSession.token);
          setCurrentHospital(parentSession.hospital);
          setHospitalDashboard(null);
          setActiveAdminSection('hospital-dashboard');
          setFeedback({ type: 'success', message: `Returned to ${parentSession.hospital.name}.` });
          navigate('/hospital-dashboard', { replace: true });
          return;
        }
      } catch (error) {
        localStorage.removeItem('hrmcs-parent-session');
      }
    }

    localStorage.removeItem('hrmcs-token');
    localStorage.removeItem('hrmcs-hospital');
    localStorage.removeItem('hrmcs-active-section');
    localStorage.removeItem('hrmcs-parent-session');
    setToken('');
    setCurrentHospital(null);
    setHospitalDashboard(null);
    setAdminSummary(null);
    setActiveAdminSection('access-account');
    setFeedback({ type: 'success', message: 'Signed out successfully.' });
    navigate('/login', { replace: true });
  };

  const createListing = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/hospitals/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...listingForm, hospitalId: currentHospital?.id }),
    });
    const result = await response.json();
    if (response.ok) {
      setListingForm({ resourceType: 'Supply', resourceName: '', quantity: 10, availableForBorrow: true, availableForOrder: true });
      setFeedback({ type: 'success', message: `Listed ${result.resourceName}` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Listing failed.' });
    }
    loadData();
  };

  const editInventoryItem = async (itemId, updates) => {
    const response = await authFetch(`/api/inventory/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: result.error || 'Inventory update failed.' });
      return false;
    }
    setFeedback({ type: 'success', message: `${result.resourceName} inventory updated across the network.` });
    await loadData();
    return true;
  };

  const setInventoryItemStatus = async (item, status) => {
    const action = status === 'Inactive' ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${item.resourceName}?`)) return false;
    const response = await authFetch(`/api/inventory/${item.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: result.error || `Unable to ${action} listing.` });
      return false;
    }
    setFeedback({ type: 'success', message: `${result.resourceName} ${status === 'Inactive' ? 'removed from' : 'restored to'} Network Availability.` });
    await loadData();
    return true;
  };

  const deleteInventoryItem = async (item) => {
    if (!window.confirm(`Permanently delete ${item.resourceName}? Listings with request history cannot be deleted.`)) return false;
    const response = await authFetch(`/api/inventory/${item.id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok) {
      setFeedback({ type: 'error', message: result.error || 'Inventory deletion failed.' });
      return false;
    }
    setFeedback({ type: 'success', message: `${item.resourceName} permanently deleted.` });
    await loadData();
    return true;
  };

  const createRequest = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...requestForm, requesterHospitalId: currentHospital?.id }),
    });
    const result = await response.json();
    if (response.ok) {
      setRequestForm({ providerHospitalId: '', resourceName: '', quantity: 5, requestType: 'Borrow', urgency: 'High', notes: '' });
      setRecommendations(result.suggestions || []);
      setFeedback({ type: 'success', message: `Requested ${result.request.resourceName}` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Request failed.' });
    }
    loadData();
  };

  const respondToRequest = async (requestId, responseValue) => {
    const response = await authFetch(`/api/requests/${requestId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: responseValue, notes: `${responseValue} by provider` }),
    });
    const result = await response.json();
    setFeedback({ type: response.ok ? 'success' : 'error', message: response.ok ? `Request ${result.id} ${result.status.toLowerCase()}` : result.error || 'Unable to respond.' });
    loadData();
  };

  const reviewClinicalRequest = async (requestId, reviewerRole, decision) => {
    const endpoint = reviewerRole === 'Pharmacist' ? 'pharmacist-review' : 'doctor-review';
    const response = await authFetch(`/api/requests/${requestId}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes: `${decision} by ${reviewerRole.toLowerCase()}` }),
    });
    const result = await response.json();
    setFeedback({
      type: response.ok ? 'success' : 'error',
      message: response.ok ? `${reviewerRole} ${decision} recorded for request ${requestId}.` : result.error || 'Clinical review failed.',
    });
    await loadData();
  };

  const approveHospital = async (hospitalId) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/approve`, { method: 'POST' });
    const result = await response.json();
    if (response.ok) {
      setPendingHospitals((prev) => prev.filter((hospital) => hospital.id !== hospitalId));
      setHospitals((prev) => prev.map((hospital) => hospital.id === hospitalId ? { ...hospital, accountStatus: 'Active' } : hospital));
      setFeedback({ type: 'success', message: `Hospital ${result.name} approved.` });
      await loadData();
    } else {
      setFeedback({ type: 'error', message: result.error || 'Approval failed.' });
    }
  };

  const deleteHospital = async (hospitalId) => {
    const confirmed = window.confirm('Delete this hospital account and its related data? This action cannot be undone.');
    if (!confirmed) return;

    const response = await authFetch(`/api/hospitals/${hospitalId}`, { method: 'DELETE' });
    const result = await response.json();
    if (response.ok) {
      setPendingHospitals((prev) => prev.filter((hospital) => hospital.id !== hospitalId));
      setHospitals((prev) => prev.filter((hospital) => hospital.id !== hospitalId));
    }
    if (response.ok && result.deletedHospital?.id === currentHospital?.id) {
      localStorage.removeItem('hrmcs-token');
      localStorage.removeItem('hrmcs-hospital');
      setToken('');
      setCurrentHospital(null);
      setHospitalDashboard(null);
      setAdminSummary(null);
      setFeedback({ type: 'success', message: 'Your account has been deleted. You have been signed out.' });
      return;
    }

    setFeedback({ type: response.ok ? 'success' : 'error', message: response.ok ? `Deleted ${result.deletedHospital?.name || 'hospital account'}.` : result.error || 'Deletion failed.' });
    loadData();
  };

  const updateHospitalEmergencyStatus = async (hospitalId, emergencyStatus) => {
    const response = await authFetch(`/api/hospitals/${hospitalId}/emergency-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emergencyStatus }),
    });
    const result = await response.json();
    if (response.ok) {
      setHospitals((prev) => prev.map((hospital) => (hospital.id === hospitalId ? result : hospital)));
      setFeedback({ type: 'success', message: `${result.name} emergency status set to ${result.emergencyStatus}.` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to update emergency status.' });
    }
  };

  const updateHospitalDistance = async (hospitalId, distance) => {
    const numericDistance = Number(distance);
    if (!Number.isFinite(numericDistance) || numericDistance < 0) {
      setFeedback({ type: 'error', message: 'Distance must be a non-negative number.' });
      return;
    }

    const response = await authFetch(`/api/hospitals/${hospitalId}/distance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ distance: numericDistance }),
    });
    const result = await response.json();
    if (response.ok) {
      setHospitals((prev) => prev.map((hospital) => (hospital.id === hospitalId ? result : hospital)));
      setFeedback({ type: 'success', message: `${result.name} distance set to ${result.distance} km.` });
      await loadData();
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to update distance.' });
    }
  };

  const registerHospital = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/hospitals/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerForm),
    });
    const result = await response.json();
    if (response.ok) {
      setFeedback({ type: 'success', message: `Hospital ${result.name} registered successfully.` });
      setGeneratedReviewerCredentials(result.reviewerCredentials || null);
      setRegisterForm({ name: '', location: '', email: '', password: '', visibility: 'Public', type: 'General', emergencyStatus: 'Medium' });
      loadData();
    } else {
      setGeneratedReviewerCredentials(null);
      setFeedback({ type: 'error', message: result.error || 'Hospital registration failed.' });
    }
  };

  // Landing / auth page (not logged in or session incomplete)
  if (!token || !currentHospital) {
    return (
      <>
        <Routes>
          <Route
            path="/login"
            element={(
              <LandingPage
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                handleLogin={handleLogin}
                registerForm={registerForm}
                setRegisterForm={setRegisterForm}
                registerHospital={registerHospital}
                generatedReviewerCredentials={generatedReviewerCredentials}
                feedback={feedback}
              />
            )}
          />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toast feedback={feedback} onDismiss={() => setFeedback({ type: '', message: '' })} />
      </>
    );
  }

  if (token && currentHospital && !dashboard) {
    return (
      <div className={`page ${currentHospital ? 'has-sidebar' : ''}`}>
        <div className="panel" style={{ textAlign: 'center', padding: 60 }}>
          <div className="skeleton skeleton-heading" style={{ margin: '0 auto 16px', width: '40%' }} />
          <div className="skeleton skeleton-text" style={{ margin: '0 auto', width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${currentHospital ? 'has-sidebar' : ''}`}>
      {currentHospital && (
        <Sidebar
          sidebarSections={sidebarSections}
          activeAdminSection={activeAdminSection}
          setActiveAdminSection={handleSectionChange}
          currentHospital={currentHospital}
          isAdmin={isAdmin}
          handleLogout={handleLogout}
        />
      )}

      <div className="main-content">
        <Routes>
          <Route
            path="/system-dashboard"
            element={(
              <>
                <DashboardSummary
                  currentHospital={currentHospital}
                  isHospitalRole={isHospitalRole}
                  isAdmin={isAdmin}
                  activeAdminSection={activeAdminSection}
                  hospitalWorkspaceStats={hospitalWorkspaceStats}
                  dashboard={dashboard}
                />
                {isAdmin && (
                  <div className="grid two-col" style={{ marginTop: '24px' }}>
                    <NotificationsPanel notifications={notifications} />
                    <CriticalShortagesPanel dashboard={dashboard} />
                  </div>
                )}
              </>
            )}
          />

          <Route
            path="/hospital-dashboard"
            element={(isHospitalRole || isReviewerRole) && hospitalDashboard ? (
              <>
                {isReviewerRole ? (
                  <AccessAccountPanel
                    currentHospital={currentHospital}
                    loginForm={loginForm}
                    setLoginForm={setLoginForm}
                    handleReviewerLogin={handleReviewerLogin}
                    handleLogout={handleLogout}
                    reviewerAccounts={reviewerAccounts}
                    updateReviewerAccount={updateReviewerAccount}
                    changeOwnPassword={changeOwnPassword}
                  />
                ) : null}
                <HospitalDashboard
                  hospitalDashboard={hospitalDashboard}
                  currentHospital={currentHospital}
                  respondToRequest={respondToRequest}
                  reviewClinicalRequest={reviewClinicalRequest}
                  getHospitalName={getHospitalName}
                  editInventoryItem={editInventoryItem}
                  setInventoryItemStatus={setInventoryItemStatus}
                  deleteInventoryItem={deleteInventoryItem}
                />
              </>
            ) : <Navigate to="/network-availability" replace />}
          />

          <Route
            path="/hospital-directory"
            element={(
              <div className="grid two-col">
                <HospitalDirectory
                  hospitalSearch={hospitalSearch}
                  setHospitalSearch={setHospitalSearch}
                  hospitals={hospitals}
                  getHospitalName={getHospitalName}
                  currentHospital={currentHospital}
                  updateHospitalEmergencyStatus={updateHospitalEmergencyStatus}
                  updateHospitalDistance={updateHospitalDistance}
                />
              </div>
            )}
          />

          <Route
            path="/network-availability"
            element={(
              <NetworkAvailability
                hospitals={hospitals}
                currentHospital={currentHospital}
                networkSearch={networkSearch}
                setNetworkSearch={setNetworkSearch}
                networkLocationFilter={networkLocationFilter}
                setNetworkLocationFilter={setNetworkLocationFilter}
                networkTypeFilter={networkTypeFilter}
                setNetworkTypeFilter={setNetworkTypeFilter}
                inventorySort={inventorySort}
                setInventorySort={setInventorySort}
                inventoryAvailabilityFilter={inventoryAvailabilityFilter}
                setInventoryAvailabilityFilter={setInventoryAvailabilityFilter}
                filterNetworkInventory={filterNetworkInventory}
                selectSupply={selectSupply}
                selectedSupplyId={selectedSupplyId}
                selectedProviderId={selectedProviderId}
                selectedNetworkItem={selectedNetworkItem}
                getHospitalName={getHospitalName}
              />
            )}
          />

          <Route
            path="/resource-actions"
            element={(
              <>
                <div className="grid two-col">
                  <RequestFiltersPanel requestStatusFilter={requestStatusFilter} setRequestStatusFilter={setRequestStatusFilter} requestTypeFilter={requestTypeFilter} setRequestTypeFilter={setRequestTypeFilter} />
                </div>
                <ResourceActions
                  currentHospital={currentHospital}
                  listingForm={listingForm}
                  setListingForm={setListingForm}
                  createListing={createListing}
                  requestForm={requestForm}
                  setRequestForm={setRequestForm}
                  activeProviders={activeProviders}
                  createRequest={createRequest}
                  selectedProvider={selectedProvider}
                  providerPublishedSupplies={providerPublishedSupplies}
                  selectedPublishedSupply={selectedPublishedSupply}
                  isRequestSubmitDisabled={isRequestSubmitDisabled}
                />
              </>
            )}
          />

          <Route
            path="/admin-oversight"
            element={currentHospital?.role === 'Admin' ? (
              <AdminOversightPanel
                adminSummaryResolved={adminSummaryResolved}
                pendingHospitals={pendingHospitals}
                requests={requests}
                hospitals={hospitals}
                currentHospital={currentHospital}
                adminRequestStatusFilter={adminRequestStatusFilter}
                setAdminRequestStatusFilter={setAdminRequestStatusFilter}
                approveHospital={approveHospital}
                deleteHospital={deleteHospital}
                approve={approve}
                reviewAdminRequest={reviewAdminRequest}
                getHospitalName={getHospitalName}
              />
            ) : <Navigate to="/system-dashboard" replace />}
          />

          <Route
            path="/admin-manage-accounts"
            element={currentHospital?.role === 'Admin' ? (
              <ManageAccountsPanel
                hospitals={hospitals}
                currentHospital={currentHospital}
                deleteHospital={deleteHospital}
                reviewerAccounts={reviewerAccounts}
                updateReviewerAccount={updateReviewerAccount}
              />
            ) : <Navigate to="/system-dashboard" replace />}
          />

          <Route
            path="/ai-recommendations"
            element={<AiRecommendationsPanel recommendations={recommendations} networkMap={recommendationMap} loading={recommendationsLoading} error={recommendationsError} />}
          />

          <Route
            path="/admin-quick-actions"
            element={currentHospital?.role === 'Admin' ? (
              <AdminQuickActionsPanel pendingProviderRequests={pendingProviderRequests} adminSummaryResolved={adminSummaryResolved} />
            ) : <Navigate to="/system-dashboard" replace />}
          />

          <Route
            path="/access-account"
            element={isHospitalRole ? (
              <AccessAccountPanel
                currentHospital={currentHospital}
                loginForm={loginForm}
                setLoginForm={setLoginForm}
                handleReviewerLogin={handleReviewerLogin}
                handleLogout={handleLogout}
                reviewerAccounts={reviewerAccounts}
                updateReviewerAccount={updateReviewerAccount}
                changeOwnPassword={changeOwnPassword}
              />
            ) : <Navigate to={isReviewerRole ? '/hospital-dashboard' : '/system-dashboard'} replace />}
          />

          <Route path="/" element={<Navigate to={sectionToPath[getDefaultSection()] || '/system-dashboard'} replace />} />
          <Route path="*" element={<Navigate to={sectionToPath[getDefaultSection()] || '/system-dashboard'} replace />} />
        </Routes>
      </div>

      <Toast feedback={feedback} onDismiss={() => setFeedback({ type: '', message: '' })} />
    </div>
  );
}

export default App;
