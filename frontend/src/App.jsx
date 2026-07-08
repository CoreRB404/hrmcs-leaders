import { useEffect, useState } from 'react';
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
import PatientSupportPanel from './components/PatientSupportPanel';
import HospitalDashboard from './components/HospitalDashboard';
import RequestFiltersPanel from './components/RequestFiltersPanel';
import ResourceRequestList from './components/ResourceRequestList';
import AdminOversightPanel from './components/AdminOversightPanel';
import AdminQuickActionsPanel from './components/AdminQuickActionsPanel';
import CriticalShortagesPanel from './components/CriticalShortagesPanel';
import AiRecommendationsPanel from './components/AiRecommendationsPanel';
import Toast from './components/Toast';

function App() {
  const [dashboard, setDashboard] = useState(null);
  const [adminSummary, setAdminSummary] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState('All');
  const [requestTypeFilter, setRequestTypeFilter] = useState('All');
  const [recommendations, setRecommendations] = useState([]);
  const [networkInventory, setNetworkInventory] = useState([]);
  const [networkStaff, setNetworkStaff] = useState([]);
  const [networkSearch, setNetworkSearch] = useState('');
  const [inventorySort, setInventorySort] = useState('quantity');
  const [staffSort, setStaffSort] = useState('available');
  const [inventoryAvailabilityFilter, setInventoryAvailabilityFilter] = useState('All');
  const [staffStatusFilter, setStaffStatusFilter] = useState('All');
  const [selectedSupplyId, setSelectedSupplyId] = useState(null);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [hospitalDashboard, setHospitalDashboard] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('hrmcs-token') || '');
  const [currentHospital, setCurrentHospital] = useState(() => JSON.parse(localStorage.getItem('hrmcs-hospital') || 'null'));
  const [loginForm, setLoginForm] = useState({ email: 'admin@hrmcs.org', password: 'Admin@1234' });
  const [listingForm, setListingForm] = useState({ resourceType: 'Supply', resourceName: '', quantity: 10, availableForBorrow: true, availableForOrder: true });
  const [requestForm, setRequestForm] = useState({ providerHospitalId: '', resourceName: '', quantity: 5, requestType: 'Borrow', notes: '' });
  const [supportForm, setSupportForm] = useState({ patientType: 'ICU', need: '', priority: 'High', notes: '' });
  const [pendingHospitals, setPendingHospitals] = useState([]);
  const [registerForm, setRegisterForm] = useState({ name: '', location: '', email: '', password: '', visibility: 'Public', type: 'General' });
  const [staffForm, setStaffForm] = useState({ role: 'Nurse', status: 'Available', count: 5 });
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

  useEffect(() => {
    if (activeAdminSection) {
      localStorage.setItem('hrmcs-active-section', activeAdminSection);
    }
  }, [activeAdminSection]);

  const authFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    return fetch(url, { ...options, headers });
  };

  const getHospitalName = (hospitalId) => hospitals.find((hospital) => hospital.id === hospitalId)?.name || hospitalId;

  const selectedNetworkItem = [...networkInventory, ...networkStaff].find((item) => item.id === selectedSupplyId);
  const activeProviders = hospitals.filter((hospital) => hospital.id !== currentHospital?.id && hospital.accountStatus === 'Active' && hospital.role !== 'Admin');
  const selectedProvider = hospitals.find((hospital) => hospital.id === requestForm.providerHospitalId);
  const isRequestSubmitDisabled = !requestForm.providerHospitalId || !requestForm.resourceName || requestForm.quantity <= 0;
  const filteredRequests = requests
    .filter((request) => {
      if (!requestStatusFilter || requestStatusFilter === 'All') return true;
      return request.status === requestStatusFilter;
    })
    .filter((request) => {
      if (!requestTypeFilter || requestTypeFilter === 'All') return true;
      return (request.requestType || request.type) === requestTypeFilter;
    });
  const pendingProviderRequests = requests.filter((request) => request.providerApproval === 'Pending');
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
  const isHospitalAccount = Boolean(currentHospital);
  const isHospitalRole = Boolean(currentHospital && currentHospital.role !== 'Admin');
  const showFocusedSection = (sectionId) => !isHospitalAccount || activeAdminSection === sectionId;
  const hospitalWorkspaceStats = isHospitalRole ? [
    { label: 'Inventory items', value: hospitalDashboard?.hospitalInventory?.length ?? 0, tone: 'primary' },
    { label: 'Open requests', value: hospitalDashboard?.hospitalRequests?.filter((request) => request.status === 'Pending' || request.providerApproval === 'Pending').length ?? 0, tone: 'accent' },
    { label: 'Staff available', value: hospitalDashboard?.hospitalStaff?.filter((staff) => (staff.availableCount ?? staff.count) > 0).length ?? 0, tone: 'success' },
    { label: 'At-risk items', value: hospitalDashboard?.hospitalInventory?.filter((item) => (item.availableQuantity ?? item.quantity) <= 5).length ?? 0, tone: 'warning' },
  ] : [];
  const sidebarSections = isAdmin
    ? [
        { id: 'system-dashboard', label: 'System dashboard', hint: 'Overview', icon: '◫' },
        { id: 'hospital-directory', label: 'Hospital directory', hint: 'Directory', icon: '◉' },
        { id: 'network-availability', label: 'Network availability', hint: 'Supplies & staff', icon: '⬢' },
        { id: 'admin-oversight', label: 'Admin oversight', hint: 'Operations', icon: '▣' },
        { id: 'ai-recommendations', label: 'AI recommendations', hint: 'Smart suggestions', icon: '◌' },
        { id: 'admin-quick-actions', label: 'Admin quick actions', hint: 'Fast tasks', icon: '⚙' },
        { id: 'access-account', label: 'Access hospital account', hint: 'Login', icon: '⟡' },
      ]
    : [
        { id: 'network-availability', label: 'Network availability', hint: 'Supplies & staff', icon: '⬢' },
        { id: 'hospital-dashboard', label: 'My dashboard', hint: 'Capacity view', icon: '◫' },
        { id: 'resource-actions', label: 'Resource actions', hint: 'Listings & requests', icon: '⤴' },
        { id: 'patient-support', label: 'Patient support', hint: 'Coordination', icon: '✚' },
        { id: 'access-account', label: 'Access account', hint: 'Login', icon: '⟡' },
      ];

  const selectSupply = (item) => {
    setSelectedSupplyId(item.id);
    setSelectedProviderId(item.hospitalId);
    setRequestForm({
      ...requestForm,
      providerHospitalId: item.hospitalId,
      resourceName: item.resourceName,
      quantity: item.quantity || requestForm.quantity,
      requestType: 'Borrow',
    });
    setActiveAdminSection('resource-actions');
    setFeedback({ type: 'success', message: `Prefilled request for ${item.resourceName}. Please review and send.` });
  };

  const selectStaffProvider = (item) => {
    setSelectedSupplyId(item.id);
    setSelectedProviderId(item.hospitalId);
    setSupportForm({
      ...supportForm,
      need: `${item.role} staff from ${getHospitalName(item.hospitalId)}`,
    });
    setActiveAdminSection('patient-support');
    setFeedback({ type: 'success', message: `Prefilled patient support request for ${item.role}. Please review and send.` });
  };

  const filterNetworkInventory = () => {
    return networkInventory
      .filter((item) => item.hospitalId !== currentHospital.id)
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
        return b.quantity - a.quantity;
      });
  };

  const filterNetworkStaff = () => {
    return networkStaff
      .filter((item) => item.hospitalId !== currentHospital.id)
      .filter((item) => {
        const query = networkSearch.toLowerCase();
        const provider = hospitals.find((hospital) => hospital.id === item.hospitalId);
        return !query || [item.role, item.status, getHospitalName(item.hospitalId), provider?.location, provider?.type].join(' ').toLowerCase().includes(query);
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
        return staffStatusFilter === 'All' || item.status === staffStatusFilter;
      })
      .sort((a, b) => {
        if (staffSort === 'role') {
          return a.role.localeCompare(b.role);
        }
        return b.count - a.count;
      });
  };

  const loadData = async () => {
    try {
      const [dashboardRes, requestsRes, hospitalsRes, notificationsRes, recommendationsRes, inventoryRes, staffRes] = await Promise.all([
        authFetch('/api/dashboard'),
        authFetch('/api/requests'),
        authFetch(`/api/hospitals?search=${encodeURIComponent(hospitalSearch)}`),
        authFetch('/api/notifications'),
        authFetch('/api/recommendations/Blood%20Bags'),
        fetch('/api/inventory'),
        fetch('/api/staff'),
      ]);

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

      if (recommendationsRes.ok) {
        setRecommendations(await recommendationsRes.json());
      }

      if (inventoryRes.ok) {
        setNetworkInventory(await inventoryRes.json());
      }

      if (staffRes.ok) {
        setNetworkStaff(await staffRes.json());
      }

      if (token && currentHospital) {
        const hospitalRes = await authFetch(`/api/hospital-dashboard/${currentHospital.id}`);
        if (hospitalRes.ok) {
          setHospitalDashboard(await hospitalRes.json());
        }
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
    loadData();
  }, [token, currentHospital, hospitalSearch]);

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

  const handleLogin = async (event) => {
    event.preventDefault();
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });

    const result = await response.json();
    if (response.ok) {
      setToken(result.token);
      setCurrentHospital(result.hospital);
      localStorage.setItem('hrmcs-token', result.token);
      localStorage.setItem('hrmcs-hospital', JSON.stringify(result.hospital));
      const defaultSection = result.hospital.role === 'Admin' ? 'system-dashboard' : 'hospital-dashboard';
      setActiveAdminSection(defaultSection);
      localStorage.setItem('hrmcs-active-section', defaultSection);
      setFeedback({ type: 'success', message: `Welcome back, ${result.hospital.name}.` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Login failed.' });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('hrmcs-token');
    localStorage.removeItem('hrmcs-hospital');
    localStorage.removeItem('hrmcs-active-section');
    setToken('');
    setCurrentHospital(null);
    setHospitalDashboard(null);
    setAdminSummary(null);
    setActiveAdminSection('system-dashboard');
    setFeedback({ type: 'success', message: 'Signed out successfully.' });
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

  const createRequest = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...requestForm, requesterHospitalId: currentHospital?.id }),
    });
    const result = await response.json();
    if (response.ok) {
      setRequestForm({ providerHospitalId: '', resourceName: '', quantity: 5, requestType: 'Borrow', notes: '' });
      setRecommendations(result.suggestions || []);
      setFeedback({ type: 'success', message: `Requested ${result.request.resourceName}` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Request failed.' });
    }
    loadData();
  };

  const submitStaffUpdate = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/hospitals/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffForm),
    });
    const result = await response.json();
    if (response.ok) {
      setStaffForm({ role: 'Nurse', status: 'Available', count: 5 });
      setFeedback({ type: 'success', message: `Staff updated: ${result.count} ${result.role}` });
    } else {
      setFeedback({ type: 'error', message: result.error || 'Staff update failed.' });
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

  const createSupportRequest = async (event) => {
    event.preventDefault();
    const response = await authFetch('/api/patient-support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...supportForm, hospitalId: currentHospital?.id, providerHospitalId: selectedProviderId || null }),
    });
    const result = await response.json();
    setSupportForm({ patientType: 'ICU', need: '', priority: 'High', notes: '' });
    setSelectedProviderId('');
    setFeedback({ type: response.ok ? 'success' : 'error', message: response.ok ? `Support request logged for ${result.need}` : result.error || 'Support request failed.' });
    loadData();
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
      setRegisterForm({ name: '', location: '', email: '', password: '', visibility: 'Public', type: 'General' });
      loadData();
    } else {
      setFeedback({ type: 'error', message: result.error || 'Hospital registration failed.' });
    }
  };

  // Landing / auth page (not logged in)
  if (!token) {
    return (
      <>
        <LandingPage
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          handleLogin={handleLogin}
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          registerHospital={registerHospital}
          feedback={feedback}
        />
        <Toast feedback={feedback} onDismiss={() => setFeedback({ type: '', message: '' })} />
      </>
    );
  }

  // Loading state
  if (!dashboard) {
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
          setActiveAdminSection={setActiveAdminSection}
          currentHospital={currentHospital}
          isAdmin={isAdmin}
          handleLogout={handleLogout}
        />
      )}

      <div className="main-content">
        {(showFocusedSection('system-dashboard') || showFocusedSection('hospital-dashboard')) && (
          <DashboardSummary
            currentHospital={currentHospital}
            isHospitalRole={isHospitalRole}
            isAdmin={isAdmin}
            activeAdminSection={activeAdminSection}
            hospitalWorkspaceStats={hospitalWorkspaceStats}
            dashboard={dashboard}
          />
        )}

        {showFocusedSection('system-dashboard') && isAdmin && (
          <div className="grid two-col" style={{ marginTop: '24px' }}>
            <NotificationsPanel notifications={notifications} />
            <CriticalShortagesPanel dashboard={dashboard} />
          </div>
        )}

        <div className="grid two-col">
          {showFocusedSection('hospital-directory') && (
            <HospitalDirectory hospitalSearch={hospitalSearch} setHospitalSearch={setHospitalSearch} hospitals={hospitals} getHospitalName={getHospitalName} />
          )}
        </div>

        {showFocusedSection('network-availability') && currentHospital && (
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
            staffSort={staffSort}
            setStaffSort={setStaffSort}
            inventoryAvailabilityFilter={inventoryAvailabilityFilter}
            setInventoryAvailabilityFilter={setInventoryAvailabilityFilter}
            staffStatusFilter={staffStatusFilter}
            setStaffStatusFilter={setStaffStatusFilter}
            filterNetworkInventory={filterNetworkInventory}
            filterNetworkStaff={filterNetworkStaff}
            selectSupply={selectSupply}
            selectStaffProvider={selectStaffProvider}
            selectedSupplyId={selectedSupplyId}
            selectedProviderId={selectedProviderId}
            selectedNetworkItem={selectedNetworkItem}
            getHospitalName={getHospitalName}
          />
        )}

        <div className="grid two-col">
          {showFocusedSection('access-account') && (
            <AccessAccountPanel currentHospital={currentHospital} loginForm={loginForm} setLoginForm={setLoginForm} handleLogin={handleLogin} handleLogout={handleLogout} />
          )}
          {showFocusedSection('resource-actions') && currentHospital && currentHospital.role !== 'Admin' && (
            <RequestFiltersPanel requestStatusFilter={requestStatusFilter} setRequestStatusFilter={setRequestStatusFilter} requestTypeFilter={requestTypeFilter} setRequestTypeFilter={setRequestTypeFilter} />
          )}
        </div>

        {showFocusedSection('hospital-dashboard') && currentHospital && currentHospital.role !== 'Admin' && hospitalDashboard && (
          <HospitalDashboard hospitalDashboard={hospitalDashboard} currentHospital={currentHospital} respondToRequest={respondToRequest} />
        )}

        {showFocusedSection('resource-actions') && (
          <ResourceActions
            currentHospital={currentHospital}
            listingForm={listingForm}
            setListingForm={setListingForm}
            createListing={createListing}
            staffForm={staffForm}
            setStaffForm={setStaffForm}
            submitStaffUpdate={submitStaffUpdate}
            requestForm={requestForm}
            setRequestForm={setRequestForm}
            activeProviders={activeProviders}
            createRequest={createRequest}
            selectedProvider={selectedProvider}
            isRequestSubmitDisabled={isRequestSubmitDisabled}
          />
        )}

        {showFocusedSection('patient-support') && (
          <PatientSupportPanel
            currentHospital={currentHospital}
            supportForm={supportForm}
            setSupportForm={setSupportForm}
            createSupportRequest={createSupportRequest}
            selectedProvider={selectedProvider}
            clearSelectedProvider={() => { setSelectedProviderId(''); setSelectedSupplyId(null); }}
          />
        )}

        {currentHospital?.role === 'Admin' && showFocusedSection('admin-oversight') && (
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
            getHospitalName={getHospitalName}
          />
        )}

        <div className="grid two-col">

          {currentHospital?.role !== 'Admin' && (
            <ResourceRequestList
              currentHospital={currentHospital}
              filteredRequests={filteredRequests}
              timelineOpenId={timelineOpenId}
              setTimelineOpenId={setTimelineOpenId}
              respondToRequest={respondToRequest}
              getHospitalName={getHospitalName}
            />
          )}
        </div>

        <div className="grid two-col">
          {showFocusedSection('ai-recommendations') && (
            <AiRecommendationsPanel recommendations={recommendations} />
          )}

          {currentHospital?.role === 'Admin' && showFocusedSection('admin-quick-actions') && (
            <AdminQuickActionsPanel pendingProviderRequests={pendingProviderRequests} adminSummaryResolved={adminSummaryResolved} />
          )}
        </div>
      </div>

      <Toast feedback={feedback} onDismiss={() => setFeedback({ type: '', message: '' })} />
    </div>
  );
}

export default App;
