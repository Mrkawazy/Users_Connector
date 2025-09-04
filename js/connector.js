// Immediately Invoked Function Expression to avoid global scope pollution
(function() {
  // Array to hold user data after fetch
  let fetchedData = [];
  // Variable for progress interval
  let progressInterval;

  /**
   * showLoader: display spinner and progress bar,
   * then simulate progress updates
   */
  function showLoader() {
    document.getElementById('loader').style.display = 'block'; // Show spinner
    const pb = document.getElementById('progressBar');
    pb.style.display = 'block'; // Show progress bar
    pb.value = 0; // Reset to 0
    // Increment bar until fetch completes
    progressInterval = setInterval(() => {
      if (pb.value < 95) pb.value += 5; // Increase by 5%
    }, 200);
  }

  /**
   * hideLoader: stop progress simulation,
   * set bar to 100%, then hide visuals
   */
  function hideLoader() {
    clearInterval(progressInterval); // Stop simulation
    const pb = document.getElementById('progressBar');
    pb.value = 100; // Complete bar
    setTimeout(() => {
      document.getElementById('loader').style.display = 'none'; // Hide spinner
      pb.style.display = 'none'; // Hide bar
    }, 300);
  }

  /**
   * fetchDataForWDC: fetch users from DHIS2
   * @param {Object} config optional connection overrides
   * @returns Promise resolving to array of users
   */
  function fetchDataForWDC(config = {}) {
    // Determine connection params: config or inputs
    const base = config.baseUrl  || document.getElementById('baseUrl').value;
    const user = config.username || document.getElementById('username').value;
    const pass = config.password || document.getElementById('password').value;

    // Construct API URL with desired fields
    const url = `${base}/api/users.json?fields=` +
      `id,username,firstName,surname,displayName,created,lastUpdated,gender,` +
      `email,phoneNumber,jobTitle,organisationUnits[id,name],userRoles[id,name],` +
      `userGroups[id,name],userCredentials[username,lastLogin]&paging=false`;

    showLoader(); // Start loader animation

    // Perform fetch with Basic Auth
    return fetch(url, {
      headers: { 'Authorization': 'Basic ' + btoa(`${user}:${pass}`) }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`); // Error handling
      return response.json(); // Parse JSON
    })
    .then(json => {
      // Map raw DHIS2 user objects to flat JS objects
      fetchedData = json.users.map(u => ({
        id: u.id, // User ID
        username: u.username, // Username
        firstName: u.firstName, // First name
        surname: u.surname, // Last name
        displayName: u.displayName, // Display name
        created: u.created, // Created timestamp
        lastUpdated: u.lastUpdated, // Updated timestamp
        gender: u.gender || '', // Gender
        email: u.email || '', // Email address
        phone: u.phoneNumber || '', // Phone number
        jobTitle: u.jobTitle || '', // Job title
        disabled: u.disabled || false, // Disabled status
        orgUnits: (u.organisationUnits||[]).map(o => o.name).join('; '), // Org units
        roles:    (u.userRoles||[]).map(r => r.name).join('; '), // Roles
        groups:   (u.userGroups||[]).map(g => g.name).join('; '), // Groups
        lastLogin: u.userCredentials?.lastLogin || '' // Last login
      }));

      updateDataTable(fetchedData); // Show preview
      document.getElementById('results').style.display = 'block'; // Reveal table
      hideLoader(); // Stop loader
      showStatus(`Loaded ${fetchedData.length} users`, 'success'); // Status
      return fetchedData; // Return data
    })
    .catch(err => {
      hideLoader(); // Ensure loader stops
      showStatus(err.message, 'error'); // Show error
      throw err; // Propagate error
    });
  }

  /**
   * updateDataTable: fill HTML table with data rows
   * @param {Array} rows user objects
   */
  function updateDataTable(rows) {
    const tbody = document.querySelector('#dataTable tbody');
    // Generate table rows via template literals
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.username}</td>
        <td>${r.firstName}</td>
        <td>${r.surname}</td>
        <td>${r.displayName}</td>
        <td>${r.created}</td>
        <td>${r.lastUpdated}</td>
        <td>${r.gender}</td>
        <td>${r.email}</td>
        <td>${r.phone}</td>
        <td>${r.jobTitle}</td>
        <td>${r.orgUnits}</td>
        <td>${r.roles}</td>
        <td>${r.groups}</td>
        <td>${r.lastLogin}</td>
        <td>${r.disabled}</td>
      </tr>
    `).join(''); // Combine rows
  }

  /**
   * showStatus: display a message below buttons
   * @param {string} msg text to show
   * @param {string} type 'success' or 'error'
   */
  function showStatus(msg, type) {
    const st = document.getElementById('status');
    st.textContent = msg; // Set message
    st.className = `status ${type}`; // Apply class
    st.style.display = 'block'; // Show
  }

  // ----- Tableau Web Data Connector setup -----

  const connector = tableau.makeConnector(); // Create connector

  connector.init = initCallback => initCallback(); // Init phase

  connector.getSchema = schemaCallback => {
    const cols = [ // Column definitions
      { id:'id', alias:'ID', dataType:tableau.dataTypeEnum.string },
      { id:'username', alias:'Username', dataType:tableau.dataTypeEnum.string },
      { id:'firstName', alias:'First Name', dataType:tableau.dataTypeEnum.string },
      { id:'surname', alias:'Last Name', dataType:tableau.dataTypeEnum.string },
      { id:'displayName', alias:'Display Name', dataType:tableau.dataTypeEnum.string },
      { id:'created', alias:'Created', dataType:tableau.dataTypeEnum.datetime },
      { id:'lastUpdated', alias:'Last Updated', dataType:tableau.dataTypeEnum.datetime },
      { id:'gender', alias:'Gender', dataType:tableau.dataTypeEnum.string },
      { id:'email', alias:'Email', dataType:tableau.dataTypeEnum.string },
      { id:'phone', alias:'Phone', dataType:tableau.dataTypeEnum.string },
      { id:'jobTitle', alias:'Job Title', dataType:tableau.dataTypeEnum.string },
      { id:'orgUnits', alias:'Org Units', dataType:tableau.dataTypeEnum.string },
      { id:'roles', alias:'Roles', dataType:tableau.dataTypeEnum.string },
      { id:'groups', alias:'Groups', dataType:tableau.dataTypeEnum.string },
      { id:'lastLogin', alias:'Last Login', dataType:tableau.dataTypeEnum.datetime },
      { id:'disabled', alias:'Disabled', dataType:tableau.dataTypeEnum.boolean }
    ];
    schemaCallback([{ id:'DHIS2Users', columns:cols }]); // Send schema
  };

  connector.getData = (table, doneCallback) => {
    const cfg = JSON.parse(tableau.connectionData); // Parse saved config
    fetchDataForWDC(cfg) // Fetch data
      .then(data => {
        table.appendRows(data); // Append rows
        doneCallback(); // Finish
      })
      .catch(err => tableau.abortWithError(err.message)); // Handle error
  };

  tableau.registerConnector(connector); // Register with Tableau

  // Button event listeners
  document.getElementById('fetchButton')
    .addEventListener('click', () => fetchDataForWDC()); // Preview

  document.getElementById('submitButton')
    .addEventListener('click', () => {
      tableau.connectionData = JSON.stringify({ // Save config
        baseUrl:  document.getElementById('baseUrl').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      });
      tableau.connectionName = 'DHIS2 – All User Fields'; // Name
      tableau.submit(); // Submit
    });
})();