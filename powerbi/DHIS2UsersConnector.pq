section DHIS2UsersConnector;

// Entry point for Power BI
[DataSource.Kind="DHIS2UsersConnector", Publish="DHIS2UsersConnector.Publish"]
shared DHIS2UsersConnector.Contents = (baseUrl as text, username as text, password as text) as table =>
    let
        // Build Basic Auth header
        authHeader = "Basic " & Binary.ToText(Text.ToBinary(username & ":" & password), BinaryEncoding.Base64),
        // Construct API URL (same fields as Tableau)
        url = Text.TrimEnd(baseUrl, "/") & "/api/users.json?fields=" &
              "id,username,firstName,surname,displayName,created,lastUpdated,gender," &
              "email,phoneNumber,jobTitle,organisationUnits[id,name],userRoles[id,name]," &
              "userGroups[id,name],userCredentials[username,lastLogin],disabled&paging=false",
        // Fetch JSON from DHIS2
        raw = Web.Contents(url, [Headers=[Authorization=authHeader]]),
        json = Json.Document(raw),
        users = json[users],
        // Convert list of records to table
        tbl = Table.FromRecords(users),
        // Expand nested lists into semicolon-delimited text
        expandOU = Table.AddColumn(tbl, "OrgUnits", each Text.Combine(List.Transform([organisationUnits], each _[name]), "; "), type text),
        expandRoles = Table.AddColumn(expandOU, "Roles", each Text.Combine(List.Transform([userRoles], each _[name]), "; "), type text),
        expandGroups = Table.AddColumn(expandRoles, "Groups", each Text.Combine(List.Transform([userGroups], each _[name]), "; "), type text),
        // Extract last login from credentials record
        addLastLogin = Table.AddColumn(expandGroups, "LastLogin", each [userCredentials][lastLogin], type datetime),
        // Reorder & select final columns
        final = Table.SelectColumns(addLastLogin, {
            "id","username","firstName","surname","displayName",
            "created","lastUpdated","gender","email","phoneNumber","jobTitle",
            "OrgUnits","Roles","Groups","LastLogin","disabled"
        })
    in
        final;

// Data source definition for UI
DHIS2UsersConnector = [
    Authentication = [
        UsernamePassword = []
    ],
    Label = "DHIS2 Users Connector"
];

DHIS2UsersConnector.Publish = [
    Beta = true,
    Category = "Other",
    ButtonText = { "DHIS2 Users", "Fetch DHIS2 users via API" },
    LearnMoreUrl = "https://play.dhis2.org/demo/api"
];
