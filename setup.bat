@echo off

REM Run truffle migrate
echo Running truffle migrate...
truffle migrate --reset
echo truffle migrate completed with error level %ERRORLEVEL%
IF %ERRORLEVEL% EQU 0 (
  echo truffle migrate succeeded. Running browserify commands...

  REM If truffle migrate succeeds, run browserify for login.js
  echo Running browserify for login.js...
  browserify ./src/js/login.js -o ./src/dist/login.bundle.js
  echo browserify for login.js completed with error level %ERRORLEVEL%
  
  REM Run browserify for app.js
  echo Running browserify for app.js...
  browserify ./src/js/app.js -o ./src/dist/app.bundle.js
  echo browserify for app.js completed with error level %ERRORLEVEL%
  
  REM Run browserify for countryconfig.js
  echo Running browserify for countryconfig.js...
  browserify ./src/js/countryconfig.js -o ./src/dist/countryconfig.bundle.js
  echo browserify for countryconfig.js completed with error level %ERRORLEVEL%
) ELSE (
  echo truffle migrate failed with error level %ERRORLEVEL%. browserify will not run.
)