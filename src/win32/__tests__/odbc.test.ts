import {
  odbc,
  odbcManager,
  SQLAllocHandle,
  SQLSetEnvAttr,
  SQLConnect,
  SQLDriverConnect,
  SQLDisconnect,
  SQLExecDirect,
  SQLNumResultCols,
  SQLDescribeCol,
  SQLRowCount,
  SQLFetch,
  SQLGetData,
  SQLFreeHandle,
} from "../odbc";

import {
  SQL_SUCCESS,
  SQL_NO_DATA,
  SQL_HANDLE_ENV,
  SQL_HANDLE_DBC,
  SQL_HANDLE_STMT,
  SQL_ATTR_ODBC_VERSION,
  SQL_OV_ODBC3,
} from "../constants";

import type { HENV, HDBC, HSTMT } from "../types";

async function runOdbcTests() {
  console.log("Starting Win32 Supabase ODBC Tests...\n");

  // Test 1: Alloc Environment & Connection Handles
  console.log("Test 1: Environment & Connection Handle Allocation...");
  const henvRef = { handle: 0 };
  let ret = SQLAllocHandle(SQL_HANDLE_ENV, 0, henvRef);
  if (ret !== SQL_SUCCESS || henvRef.handle <= 0) {
    throw new Error(`SQLAllocHandle(ENV) failed, ret=${ret}`);
  }
  const henv = henvRef.handle as HENV;

  ret = SQLSetEnvAttr(henv, SQL_ATTR_ODBC_VERSION, SQL_OV_ODBC3);
  if (ret !== SQL_SUCCESS) {
    throw new Error("SQLSetEnvAttr failed");
  }

  const hdbcRef = { handle: 0 };
  ret = SQLAllocHandle(SQL_HANDLE_DBC, henv, hdbcRef);
  if (ret !== SQL_SUCCESS || hdbcRef.handle <= 0) {
    throw new Error(`SQLAllocHandle(DBC) failed, ret=${ret}`);
  }
  const hdbc = hdbcRef.handle as HDBC;
  console.log(`✓ Handles allocated: HENV=${henv}, HDBC=${hdbc}`);

  // Test 2: Connect to DSN
  console.log("Test 2: SQLConnect to 'Supabase_Demo'...");
  ret = SQLConnect(hdbc, "Supabase_Demo");
  if (ret !== SQL_SUCCESS) {
    throw new Error("SQLConnect to Supabase_Demo failed");
  }
  console.log("✓ Connected to Supabase_Demo DSN");

  // Test 3: Allocate Statement Handle and Execute Query
  console.log("Test 3: SQLExecDirect ('SELECT * FROM employees')...");
  const hstmtRef = { handle: 0 };
  ret = SQLAllocHandle(SQL_HANDLE_STMT, hdbc, hstmtRef);
  if (ret !== SQL_SUCCESS || hstmtRef.handle <= 0) {
    throw new Error("SQLAllocHandle(STMT) failed");
  }
  const hstmt = hstmtRef.handle as HSTMT;

  ret = await SQLExecDirect(hstmt, "SELECT * FROM employees");
  if (ret !== SQL_SUCCESS) {
    throw new Error("SQLExecDirect failed");
  }

  const colCountRef = { count: 0 };
  SQLNumResultCols(hstmt, colCountRef);
  if (colCountRef.count !== 7) {
    throw new Error(`Expected 7 columns for employees, got ${colCountRef.count}`);
  }

  const rowCountRef = { count: 0 };
  SQLRowCount(hstmt, rowCountRef);
  if (rowCountRef.count !== 6) {
    throw new Error(`Expected 6 rows for employees, got ${rowCountRef.count}`);
  }

  const col1 = SQLDescribeCol(hstmt, 1);
  if (col1.status !== SQL_SUCCESS || col1.column?.name !== "id") {
    throw new Error(`Expected column 1 to be 'id', got: ${col1.column?.name}`);
  }
  console.log(`✓ Query executed: ${colCountRef.count} columns, ${rowCountRef.count} rows`);

  // Test 4: Fetch and Navigate Cursor
  console.log("Test 4: SQLFetch & SQLGetData cursor navigation...");
  let fetchedCount = 0;
  const employeeNames: string[] = [];

  while (SQLFetch(hstmt) === SQL_SUCCESS) {
    fetchedCount++;
    const first = SQLGetData(hstmt, 2); // first_name
    const last = SQLGetData(hstmt, 3); // last_name
    employeeNames.push(`${first.value} ${last.value}`);
  }

  if (fetchedCount !== 6) {
    throw new Error(`Expected to fetch 6 rows, got ${fetchedCount}`);
  }
  if (!employeeNames.includes("John Doe") || !employeeNames.includes("Michael Scott")) {
    throw new Error(`Missing expected employee in result: ${employeeNames.join(", ")}`);
  }
  console.log(`✓ Fetched ${fetchedCount} rows: ${employeeNames.join(", ")}`);

  // Test 5: Filtered and Sorted Query (WHERE and ORDER BY)
  console.log("Test 5: Filtered Query with WHERE and ORDER BY...");
  const hstmt2Ref = { handle: 0 };
  SQLAllocHandle(SQL_HANDLE_STMT, hdbc, hstmt2Ref);
  const hstmt2 = hstmt2Ref.handle as HSTMT;

  ret = await SQLExecDirect(
    hstmt2,
    "SELECT first_name, department, salary FROM employees WHERE department = 'Engineering' ORDER BY salary DESC"
  );
  if (ret !== SQL_SUCCESS) throw new Error("Filtered query failed");

  const engRows: any[] = [];
  while (SQLFetch(hstmt2) === SQL_SUCCESS) {
    const name = SQLGetData(hstmt2, 1).value;
    const dept = SQLGetData(hstmt2, 2).value;
    const salary = SQLGetData(hstmt2, 3).value;
    engRows.push({ name, dept, salary });
  }

  if (engRows.length !== 2) {
    throw new Error(`Expected 2 Engineering employees, got ${engRows.length}`);
  }
  if (engRows[0].name !== "Jane" || engRows[0].salary !== 115000) {
    throw new Error(`Expected Jane with 115000 first, got: ${JSON.stringify(engRows[0])}`);
  }

  console.log(`✓ Filtered query returned top salary: ${engRows[0].name} ($${engRows[0].salary})`);

  // Test 6: SQLDriverConnect with connection string
  console.log("Test 6: SQLDriverConnect with connection string...");
  const hdbc2Ref = { handle: 0 };
  SQLAllocHandle(SQL_HANDLE_DBC, henv, hdbc2Ref);
  const hdbc2 = hdbc2Ref.handle as HDBC;

  ret = SQLDriverConnect(hdbc2, "DSN=Supabase_Demo;URL=https://demo.supabase.co;Key=xyz123;Schema=public;");
  if (ret !== SQL_SUCCESS) throw new Error("SQLDriverConnect failed");
  console.log("✓ SQLDriverConnect succeeded");

  // Test 7: DSN Manager persistence
  console.log("Test 7: ODBCDataSourceManager CRUD...");
  const initialDsns = odbcManager.getDsns();
  if (initialDsns.length < 2) {
    throw new Error("Expected at least 2 default DSNs");
  }

  odbcManager.setDsn({
    dsn: "Custom_Supabase_Test",
    driver: "Supabase PostgreSQL Driver",
    description: "Test Custom DSN",
    url: "https://custom.supabase.co",
    apiKey: "test-token",
    schema: "public",
  });

  const found = odbcManager.getDsn("Custom_Supabase_Test");
  if (!found || found.apiKey !== "test-token") {
    throw new Error("Custom DSN was not saved properly");
  }
  odbcManager.removeDsn("Custom_Supabase_Test");
  console.log("✓ DSN Manager CRUD verified");

  // Test 8: Free Handles & Disconnect
  console.log("Test 8: Cleanup and Free Handles...");
  SQLFreeHandle(SQL_HANDLE_STMT, hstmt);
  SQLFreeHandle(SQL_HANDLE_STMT, hstmt2);
  SQLDisconnect(hdbc);
  SQLDisconnect(hdbc2);
  SQLFreeHandle(SQL_HANDLE_DBC, hdbc);
  SQLFreeHandle(SQL_HANDLE_DBC, hdbc2);
  SQLFreeHandle(SQL_HANDLE_ENV, henv);
  console.log("✓ All handles released cleanly");

  console.log("\nALL SUPABASE ODBC TESTS PASSED! 🗄️⚡🎉");
}

runOdbcTests().catch((err) => {
  console.error("ODBC test failed:", err);
  process.exit(1);
});
