#!/usr/bin/env node

/**
 * System Check Script
 * Verifies all system requirements and configurations
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔍 CyberSecure System Check\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkCommand(command, description) {
  return new Promise((resolve) => {
    const child = spawn(command, ['--version'], { stdio: 'pipe' });
    
    child.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${description}`, 'green');
        resolve(true);
      } else {
        log(`❌ ${description} - Not found`, 'red');
        resolve(false);
      }
    });
    
    child.on('error', () => {
      log(`❌ ${description} - Not found`, 'red');
      resolve(false);
    });
  });
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Not found`, 'red');
    return false;
  }
}

function checkNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const interfaceNames = Object.keys(interfaces);
  
  log('\n📡 Network Interfaces:', 'blue');
  interfaceNames.forEach(name => {
    const iface = interfaces[name];
    const hasIPv4 = iface.some(addr => addr.family === 'IPv4' && !addr.internal);
    if (hasIPv4) {
      log(`  ✅ ${name} - Active`, 'green');
    } else {
      log(`  ⚠️  ${name} - No IPv4 address`, 'yellow');
    }
  });
  
  return interfaceNames;
}

function checkEnvironmentFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found', 'red');
    log('   Please copy .env.example to .env and configure it', 'yellow');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ];
  
  let allConfigured = true;
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`) && !envContent.includes(`${varName}=your-`)) {
      log(`  ✅ ${varName} configured`, 'green');
    } else {
      log(`  ❌ ${varName} not configured`, 'red');
      allConfigured = false;
    }
  });
  
  return allConfigured;
}

async function runSystemCheck() {
  log('1. Checking System Requirements', 'blue');
  
  const nodeOk = await checkCommand('node', 'Node.js');
  const npmOk = await checkCommand('npm', 'NPM');
  const tcpdumpOk = await checkCommand('tcpdump', 'tcpdump');
  
  log('\n2. Checking Project Files', 'blue');
  
  const packageOk = checkFile(path.join(__dirname, '..', 'package.json'), 'Backend package.json');
  const frontendPackageOk = checkFile(path.join(__dirname, '..', '..', 'package.json'), 'Frontend package.json');
  
  log('\n3. Checking Configuration', 'blue');
  
  const envOk = checkEnvironmentFile();
  
  log('\n4. Network Interface Check', 'blue');
  
  const interfaces = checkNetworkInterfaces();
  
  log('\n5. Permission Check', 'blue');
  
  if (process.getuid && process.getuid() === 0) {
    log('✅ Running with root privileges (required for packet capture)', 'green');
  } else {
    log('⚠️  Not running with root privileges', 'yellow');
    log('   Network packet capture requires sudo/root access', 'yellow');
  }
  
  log('\n📋 System Check Summary', 'blue');
  
  if (nodeOk && npmOk && tcpdumpOk && packageOk && frontendPackageOk && envOk) {
    log('🎉 System is ready to run!', 'green');
    log('\nNext steps:', 'blue');
    log('1. Start backend: cd server && sudo npm start', 'yellow');
    log('2. Start frontend: npm run dev', 'yellow');
    log('3. Open browser: http://localhost:5173', 'yellow');
  } else {
    log('❌ System has configuration issues', 'red');
    log('\nPlease fix the issues above before running the system', 'yellow');
  }
  
  if (interfaces.length > 0) {
    log('\n💡 Suggested network interfaces for monitoring:', 'blue');
    const commonInterfaces = interfaces.filter(name => 
      name.startsWith('eth') || 
      name.startsWith('wlan') || 
      name.startsWith('enp') || 
      name.startsWith('wlp')
    );
    
    if (commonInterfaces.length > 0) {
      log(`   NETWORK_INTERFACES=${commonInterfaces.join(',')}`, 'yellow');
    } else {
      log(`   NETWORK_INTERFACES=${interfaces.slice(0, 2).join(',')}`, 'yellow');
    }
  }
}

// Run the system check
runSystemCheck().catch(console.error);