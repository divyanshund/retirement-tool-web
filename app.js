/* ============================================
   Retirement Planner - Application Logic
   ============================================ */

// ============================================
// State
// ============================================
const state = {
    currentAge: 30,
    retirementAge: 67,
    annualSalary: 35000,
    currentPotValue: 15000,
    employeeContrib: 5,
    employerContrib: 3,
    additionalPots: [],
    dbPensions: [],
    growthRate: 'balanced',
    inflationRate: 2.5,
    lifeExpectancy: 92,
    statePensionAge: 67,
    statePensionAmount: 11502,
    includeStatePension: true,
    takeLumpSum: false,
    desiredIncome: null, // null = use sustainable income
};

let nextPotId = 1;
let nextDbId = 1;

// ============================================
// Constants
// ============================================
const GROWTH_RATES = {
    careful: 2,
    balanced: 5,
    optimistic: 8,
};

const GROWTH_LABELS = {
    careful: 'careful',
    balanced: 'balanced',
    optimistic: 'optimistic',
};

const SALARY_RANGES = [
    { min: 0, max: 12199, label: 'Up to \u00a312,199', pct: 80 },
    { min: 12200, max: 22399, label: '\u00a312,200 to \u00a322,399', pct: 70 },
    { min: 22400, max: 31999, label: '\u00a322,400 to \u00a331,999', pct: 67 },
    { min: 32000, max: 51299, label: '\u00a332,000 to \u00a351,299', pct: 67 },
    { min: 51300, max: Infinity, label: '\u00a351,300 and above', pct: 50 },
];

// ============================================
// Charts (global references)
// ============================================
let potChart = null;
let incomeChart = null;

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    createCharts();
    calculate();
});

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
    // Personal details
    bindInput('currentAge', 'number', v => { state.currentAge = v; });
    bindInput('retirementAge', 'number', v => { state.retirementAge = v; });
    bindCurrencyInput('annualSalary', v => { state.annualSalary = v; });

    // Workplace pension
    bindCurrencyInput('currentPotValue', v => { state.currentPotValue = v; });
    bindInput('employeeContrib', 'number', v => { state.employeeContrib = v; });
    bindInput('employerContrib', 'number', v => { state.employerContrib = v; });

    // Assumptions
    bindInput('inflationRate', 'number', v => { state.inflationRate = v; });
    bindInput('lifeExpectancy', 'number', v => { state.lifeExpectancy = v; });
    bindInput('statePensionAge', 'number', v => { state.statePensionAge = v; });
    bindCurrencyInput('statePensionAmount', v => { state.statePensionAmount = v; });

    // Growth rate selector
    document.querySelectorAll('.growth-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.growth-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.growthRate = btn.dataset.rate;
            calculate();
        });
    });

    // Toggles
    document.getElementById('takeLumpSum').addEventListener('change', e => {
        state.takeLumpSum = e.target.checked;
        state.desiredIncome = null; // reset desired income on toggle change
        calculate();
    });
    document.getElementById('includeStatePension').addEventListener('change', e => {
        state.includeStatePension = e.target.checked;
        state.desiredIncome = null; // reset desired income on toggle change
        calculate();
    });

    // Desired income editing
    const desiredIncomeEl = document.getElementById('desiredIncome');
    desiredIncomeEl.addEventListener('input', () => {
        const val = parseCurrency(desiredIncomeEl.value);
        state.desiredIncome = val > 0 ? val : null;
        calculate(true); // skip updating income field
    });
    desiredIncomeEl.addEventListener('blur', () => {
        if (state.desiredIncome !== null) {
            desiredIncomeEl.value = formatNumber(state.desiredIncome);
        }
    });

    // Reset income button
    document.getElementById('resetIncomeBtn').addEventListener('click', () => {
        state.desiredIncome = null;
        calculate();
    });

    // Add pension pot
    document.getElementById('addPotBtn').addEventListener('click', addPensionPot);

    // Add DB pension
    document.getElementById('addDbBtn').addEventListener('click', addDBPension);

    // Assumptions accordion
    document.getElementById('assumptionsToggle').addEventListener('click', () => {
        const toggle = document.getElementById('assumptionsToggle');
        const body = document.getElementById('assumptionsBody');
        toggle.classList.toggle('open');
        body.classList.toggle('open');
    });
}

function bindInput(id, type, setter) {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
        const val = type === 'number' ? parseFloat(el.value) || 0 : el.value;
        setter(val);
        state.desiredIncome = null; // reset desired on input change
        calculate();
    });
}

function bindCurrencyInput(id, setter) {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
        const val = parseCurrency(el.value);
        setter(val);
        state.desiredIncome = null; // reset desired on input change
        calculate();
    });
    el.addEventListener('blur', () => {
        const val = parseCurrency(el.value);
        if (val >= 0) {
            el.value = formatNumber(val);
        }
    });
    el.addEventListener('focus', () => {
        const val = parseCurrency(el.value);
        el.value = val > 0 ? val.toString() : '';
    });
}

// ============================================
// Dynamic Forms: Additional Pension Pots
// ============================================
function addPensionPot() {
    const id = nextPotId++;
    state.additionalPots.push({ id, name: 'Pension pot ' + id, value: 0, monthlyContribution: 0 });

    const container = document.getElementById('additionalPotsContainer');
    const item = document.createElement('div');
    item.className = 'pot-item';
    item.id = 'pot-' + id;
    item.innerHTML =
        '<div class="pot-title">Pension Pot ' + id + '</div>' +
        '<button class="remove-btn" onclick="removePensionPot(' + id + ')" title="Remove">&times;</button>' +
        '<div class="form-group">' +
        '  <label>Current Value</label>' +
        '  <div class="input-with-prefix">' +
        '    <span class="input-prefix">&pound;</span>' +
        '    <input type="text" class="pot-value" data-pot-id="' + id + '" value="0" inputmode="numeric">' +
        '  </div>' +
        '</div>' +
        '<div class="form-group">' +
        '  <label>Monthly Contribution</label>' +
        '  <div class="input-with-prefix">' +
        '    <span class="input-prefix">&pound;</span>' +
        '    <input type="text" class="pot-contribution" data-pot-id="' + id + '" value="0" inputmode="numeric">' +
        '  </div>' +
        '</div>';
    container.appendChild(item);

    // Bind events for the new inputs
    const valueInput = item.querySelector('.pot-value');
    const contribInput = item.querySelector('.pot-contribution');

    [valueInput, contribInput].forEach(input => {
        input.addEventListener('input', () => {
            updatePotFromDOM(id);
            state.desiredIncome = null;
        });
        input.addEventListener('blur', () => {
            const val = parseCurrency(input.value);
            input.value = formatNumber(val);
        });
        input.addEventListener('focus', () => {
            const val = parseCurrency(input.value);
            input.value = val > 0 ? val.toString() : '';
        });
    });

    calculate();
}

function updatePotFromDOM(id) {
    const pot = state.additionalPots.find(p => p.id === id);
    if (!pot) return;
    const item = document.getElementById('pot-' + id);
    pot.value = parseCurrency(item.querySelector('.pot-value').value);
    pot.monthlyContribution = parseCurrency(item.querySelector('.pot-contribution').value);
    calculate();
}

function removePensionPot(id) {
    state.additionalPots = state.additionalPots.filter(p => p.id !== id);
    const el = document.getElementById('pot-' + id);
    if (el) el.remove();
    state.desiredIncome = null;
    calculate();
}

// ============================================
// Dynamic Forms: Defined Benefit Pensions
// ============================================
function addDBPension() {
    const id = nextDbId++;
    state.dbPensions.push({ id, provider: '', annualIncome: 0 });

    const container = document.getElementById('dbPensionsContainer');
    const item = document.createElement('div');
    item.className = 'db-item';
    item.id = 'db-' + id;
    item.innerHTML =
        '<div class="db-title">Defined Benefit Pension ' + id + '</div>' +
        '<button class="remove-btn" onclick="removeDBPension(' + id + ')" title="Remove">&times;</button>' +
        '<div class="form-group">' +
        '  <label>Provider Name</label>' +
        '  <input type="text" class="db-provider" data-db-id="' + id + '" placeholder="e.g. Teachers\' Pension">' +
        '</div>' +
        '<div class="form-group">' +
        '  <label>Expected Annual Income at Retirement</label>' +
        '  <div class="input-with-prefix">' +
        '    <span class="input-prefix">&pound;</span>' +
        '    <input type="text" class="db-income" data-db-id="' + id + '" value="0" inputmode="numeric">' +
        '  </div>' +
        '</div>';
    container.appendChild(item);

    const incomeInput = item.querySelector('.db-income');
    incomeInput.addEventListener('input', () => {
        updateDBFromDOM(id);
        state.desiredIncome = null;
    });
    incomeInput.addEventListener('blur', () => {
        const val = parseCurrency(incomeInput.value);
        incomeInput.value = formatNumber(val);
    });
    incomeInput.addEventListener('focus', () => {
        const val = parseCurrency(incomeInput.value);
        incomeInput.value = val > 0 ? val.toString() : '';
    });

    calculate();
}

function updateDBFromDOM(id) {
    const db = state.dbPensions.find(p => p.id === id);
    if (!db) return;
    const item = document.getElementById('db-' + id);
    db.provider = item.querySelector('.db-provider').value;
    db.annualIncome = parseCurrency(item.querySelector('.db-income').value);
    calculate();
}

function removeDBPension(id) {
    state.dbPensions = state.dbPensions.filter(p => p.id !== id);
    const el = document.getElementById('db-' + id);
    if (el) el.remove();
    state.desiredIncome = null;
    calculate();
}

// ============================================
// Core Calculations
// ============================================
function calculate(skipIncomeFieldUpdate) {
    // Validate
    if (state.retirementAge <= state.currentAge) return;
    if (state.lifeExpectancy <= state.retirementAge) return;

    const nominalGrowth = GROWTH_RATES[state.growthRate] / 100;
    const inflation = state.inflationRate / 100;
    const realGrowth = (1 + nominalGrowth) / (1 + inflation) - 1;
    const yearsToRetirement = state.retirementAge - state.currentAge;

    // --- Project workplace pension pot ---
    const monthlyRealGrowth = Math.pow(1 + realGrowth, 1 / 12) - 1;
    const monthlyContribution = (state.employeeContrib + state.employerContrib) / 100 * state.annualSalary / 12;

    let wpPot = state.currentPotValue;
    const potHistory = [{ age: state.currentAge, value: wpPot }];

    for (let year = 0; year < yearsToRetirement; year++) {
        for (let month = 0; month < 12; month++) {
            wpPot = wpPot * (1 + monthlyRealGrowth) + monthlyContribution;
        }
        potHistory.push({ age: state.currentAge + year + 1, value: Math.max(0, wpPot) });
    }

    // --- Project additional pots ---
    let additionalTotal = 0;
    const additionalDetails = [];
    for (const pot of state.additionalPots) {
        let potValue = pot.value || 0;
        const mc = pot.monthlyContribution || 0;
        for (let year = 0; year < yearsToRetirement; year++) {
            for (let month = 0; month < 12; month++) {
                potValue = potValue * (1 + monthlyRealGrowth) + mc;
            }
        }
        potValue = Math.max(0, potValue);
        additionalTotal += potValue;
        additionalDetails.push({ id: pot.id, name: pot.name, projectedValue: potValue });
    }

    // --- Total pot at retirement ---
    const totalPotAtRetirement = Math.max(0, wpPot + additionalTotal);

    // --- Lump sum ---
    const lumpSumMax = 268275;
    const lumpSum = state.takeLumpSum ? Math.min(totalPotAtRetirement * 0.25, lumpSumMax) : 0;
    const drawdownPot = totalPotAtRetirement - lumpSum;

    // --- Defined benefit total annual income ---
    const dbIncome = state.dbPensions.reduce(function (sum, p) { return sum + (p.annualIncome || 0); }, 0);

    // --- Calculate sustainable total income using binary search ---
    const sustainableIncome = calcSustainableTotalIncome(
        drawdownPot, realGrowth, state.retirementAge, state.lifeExpectancy,
        state.statePensionAge, state.statePensionAmount, state.includeStatePension, dbIncome
    );

    // --- Use desired income or sustainable ---
    const displayIncome = state.desiredIncome !== null ? state.desiredIncome : sustainableIncome;

    // --- Project drawdown year by year ---
    let remainingPot = drawdownPot;
    const incomeByYear = [];
    let fullIncomeLastAge = state.retirementAge;

    for (let age = state.retirementAge; age <= state.lifeExpectancy; age++) {
        const stateIncome = (state.includeStatePension && age >= state.statePensionAge)
            ? state.statePensionAmount : 0;
        const dbIncomeYear = dbIncome;

        // How much the user needs from the pot this year
        const neededFromPot = Math.max(0, displayIncome - stateIncome - dbIncomeYear);
        const actualFromPot = Math.min(neededFromPot, Math.max(0, remainingPot));

        // Deduct withdrawal, then apply growth to remaining pot
        remainingPot -= actualFromPot;
        remainingPot = remainingPot * (1 + realGrowth);
        remainingPot = Math.max(0, remainingPot);

        const totalIncome = actualFromPot + stateIncome + dbIncomeYear;

        incomeByYear.push({
            age: age,
            personal: actualFromPot,
            state: stateIncome,
            db: dbIncomeYear,
            total: totalIncome,
            remainingPot: remainingPot,
        });

        // Track how long the full desired total income is achieved
        if (displayIncome > 0 && totalIncome >= displayIncome * 0.99) {
            fullIncomeLastAge = age;
        }
    }

    // If no withdrawal needed (desired <= state + DB), pot never depletes
    if (displayIncome <= 0) {
        fullIncomeLastAge = state.lifeExpectancy;
    }

    // Build results
    const results = {
        totalPotAtRetirement: totalPotAtRetirement,
        lumpSum: lumpSum,
        drawdownPot: drawdownPot,
        potHistory: potHistory,
        wpProjected: wpPot,
        additionalDetails: additionalDetails,
        additionalTotal: additionalTotal,
        dbIncome: dbIncome,
        sustainableIncome: sustainableIncome,
        displayIncome: displayIncome,
        incomeByYear: incomeByYear,
        fullIncomeLastAge: fullIncomeLastAge,
        realGrowth: realGrowth,
        monthlyContribution: monthlyContribution,
    };

    // Update UI
    updateUI(results, skipIncomeFieldUpdate);
    updateCharts(results);
}

/**
 * Find the maximum sustainable total annual income such that the pot
 * lasts from retirement age to life expectancy.
 * Uses binary search over the income level, simulating drawdown each time.
 * Accounts for state pension starting at a different age.
 */
function calcSustainableTotalIncome(pot, realGrowthRate, retirementAge, lifeExpectancy, spAge, spAmount, includeSP, dbIncome) {
    if (pot <= 0) {
        // No pot — income is just state + DB
        const minState = (includeSP && retirementAge >= spAge) ? spAmount : 0;
        return dbIncome + minState;
    }

    // Lower bound: income from guaranteed sources only (no pot drawdown)
    const guarLow = dbIncome;
    // Upper bound: generous estimate
    const years = lifeExpectancy - retirementAge;
    const guarHigh = pot / Math.max(years, 1) * 3 + dbIncome + (includeSP ? spAmount : 0);

    let low = guarLow;
    let high = Math.max(guarHigh, guarLow + 1);

    // Binary search for sustainable income
    for (let i = 0; i < 60; i++) {
        const mid = (low + high) / 2;
        const depleted = simulateDrawdown(pot, mid, realGrowthRate, retirementAge, lifeExpectancy, spAge, spAmount, includeSP, dbIncome);
        if (depleted) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return Math.round((low + high) / 2);
}

/**
 * Returns true if the pot is depleted before reaching life expectancy
 * at the given total income level.
 */
function simulateDrawdown(pot, totalIncome, realGrowthRate, retirementAge, lifeExpectancy, spAge, spAmount, includeSP, dbIncome) {
    let remaining = pot;

    for (let age = retirementAge; age <= lifeExpectancy; age++) {
        const stateInc = (includeSP && age >= spAge) ? spAmount : 0;
        const neededFromPot = Math.max(0, totalIncome - stateInc - dbIncome);

        remaining -= neededFromPot;
        if (remaining < -0.01) return true; // depleted

        remaining *= (1 + realGrowthRate);
        remaining = Math.max(0, remaining);
    }

    return false; // pot survived
}

// ============================================
// UI Updates
// ============================================
function updateUI(results, skipIncomeFieldUpdate) {
    var s = state;

    // Hero
    animateValue('totalPotValue', results.totalPotAtRetirement);
    document.getElementById('heroRetAge').textContent = s.retirementAge;
    document.getElementById('heroGrowthDesc').textContent = GROWTH_LABELS[s.growthRate];
    document.getElementById('heroGrowthPct').textContent = GROWTH_RATES[s.growthRate];

    // Pensions included badges
    updatePensionsBadges(results);

    // Monthly contribution display
    document.getElementById('monthlyContribDisplay').textContent = formatCurrency(results.monthlyContribution);

    // Lump sum info
    document.getElementById('lumpSumInfo').textContent =
        formatCurrency(results.totalPotAtRetirement * 0.25) + ' at age ' + s.retirementAge;
    document.getElementById('lumpSumRow').style.display = s.takeLumpSum ? 'flex' : 'none';
    document.getElementById('lumpSumValue').textContent = formatCurrency(results.lumpSum);

    // State pension info
    document.getElementById('statePensionInfo').textContent =
        formatCurrency(s.statePensionAmount) + ' each year from age ' + s.statePensionAge;

    // Income
    if (!skipIncomeFieldUpdate) {
        document.getElementById('desiredIncome').value = formatNumber(results.displayIncome);
    }
    document.getElementById('resetIncomeBtn').classList.toggle('hidden', s.desiredIncome === null);

    // Income lasting range
    var lastAge = Math.min(results.fullIncomeLastAge, s.lifeExpectancy);
    document.getElementById('incomeLastingRange').textContent =
        s.retirementAge + '\u2013' + lastAge + ' years old';

    // Legend visibility
    document.getElementById('legendState').style.display = s.includeStatePension ? 'flex' : 'none';
    document.getElementById('legendDb').style.display = results.dbIncome > 0 ? 'flex' : 'none';

    // Salary suggestion table
    updateSalaryTable(s.annualSalary);

    // Assumption details
    document.getElementById('assumeGrowthDesc').textContent = GROWTH_LABELS[s.growthRate];
    document.getElementById('assumeGrowthPct').textContent = GROWTH_RATES[s.growthRate];
    document.getElementById('assumeInflation').textContent = s.inflationRate;
}

function updatePensionsBadges(results) {
    var container = document.getElementById('pensionsIncluded');
    var html = '';

    if (results.wpProjected > 0) {
        html += '<span class="pension-badge"><span class="badge-dot"></span>Workplace: ' + formatCurrency(results.wpProjected) + '</span>';
    }

    for (var i = 0; i < results.additionalDetails.length; i++) {
        var pot = results.additionalDetails[i];
        if (pot.projectedValue > 0) {
            html += '<span class="pension-badge"><span class="badge-dot"></span>' + pot.name + ': ' + formatCurrency(pot.projectedValue) + '</span>';
        }
    }

    if (results.dbIncome > 0) {
        html += '<span class="pension-badge"><span class="badge-dot" style="background:#5BB5A2"></span>Defined benefit: ' + formatCurrency(results.dbIncome) + '/yr</span>';
    }

    container.innerHTML = html;
}

function updateSalaryTable(salary) {
    var tbody = document.getElementById('salaryTableBody');
    var html = '';
    for (var i = 0; i < SALARY_RANGES.length; i++) {
        var range = SALARY_RANGES[i];
        var isActive = salary >= range.min && salary <= range.max;
        var targetIncome = Math.round(salary * range.pct / 100);
        html += '<tr class="' + (isActive ? 'active-row' : '') + '">' +
            '<td>' + range.label + '</td>' +
            '<td>' + range.pct + '%</td>' +
            '<td>' + formatCurrency(targetIncome) + '</td>' +
            '</tr>';
    }
    tbody.innerHTML = html;
}

// ============================================
// Chart Creation & Updates
// ============================================
function createCharts() {
    createPotChart();
    createIncomeChart();
}

function createPotChart() {
    var ctx = document.getElementById('potChart').getContext('2d');

    var gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(33, 143, 183, 0.25)');
    gradient.addColorStop(1, 'rgba(33, 143, 183, 0.01)');

    potChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Pension Pot Value',
                data: [],
                borderColor: '#218FB7',
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#218FB7',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A2B3C',
                    titleFont: { family: "'Inter', sans-serif", weight: '600', size: 12 },
                    bodyFont: { family: "'Inter', sans-serif", weight: '500', size: 13 },
                    padding: { top: 10, bottom: 10, left: 14, right: 14 },
                    cornerRadius: 10,
                    displayColors: false,
                    callbacks: {
                        title: function (items) { return 'Age ' + items[0].label; },
                        label: function (item) { return formatCurrency(item.raw); },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
                        color: '#8A9AAC',
                        maxTicksLimit: 10,
                    },
                    title: {
                        display: true,
                        text: 'Age',
                        font: { family: "'Inter', sans-serif", size: 12, weight: '600' },
                        color: '#5A6B7C',
                    },
                    border: { display: false },
                },
                y: {
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
                        color: '#8A9AAC',
                        callback: function (v) { return formatAxisValue(v); },
                        maxTicksLimit: 6,
                    },
                    border: { display: false },
                },
            },
        },
    });
}

function createIncomeChart() {
    var ctx = document.getElementById('incomeChart').getContext('2d');

    incomeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'State pension',
                    data: [],
                    backgroundColor: '#F0B4C8',
                    borderRadius: 0,
                    borderSkipped: false,
                    order: 3,
                },
                {
                    label: 'Defined benefit',
                    data: [],
                    backgroundColor: '#5BB5A2',
                    borderRadius: 0,
                    borderSkipped: false,
                    order: 2,
                },
                {
                    label: 'Your pensions',
                    data: [],
                    backgroundColor: '#218FB7',
                    borderRadius: { topLeft: 3, topRight: 3 },
                    borderSkipped: false,
                    order: 1,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1A2B3C',
                    titleFont: { family: "'Inter', sans-serif", weight: '600', size: 12 },
                    bodyFont: { family: "'Inter', sans-serif", weight: '500', size: 12 },
                    padding: { top: 10, bottom: 10, left: 14, right: 14 },
                    cornerRadius: 10,
                    callbacks: {
                        title: function (items) { return 'Age ' + items[0].label; },
                        label: function (item) {
                            if (item.raw === 0) return null;
                            return item.dataset.label + ': ' + formatCurrency(item.raw);
                        },
                        footer: function (items) {
                            var total = 0;
                            for (var i = 0; i < items.length; i++) total += (items[i].raw || 0);
                            return 'Total: ' + formatCurrency(total);
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: {
                        font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
                        color: '#8A9AAC',
                        maxTicksLimit: 15,
                    },
                    title: {
                        display: true,
                        text: 'Age',
                        font: { family: "'Inter', sans-serif", size: 12, weight: '600' },
                        color: '#5A6B7C',
                    },
                    border: { display: false },
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(0,0,0,0.04)' },
                    ticks: {
                        font: { family: "'Inter', sans-serif", size: 11, weight: '500' },
                        color: '#8A9AAC',
                        callback: function (v) { return formatAxisValue(v); },
                        maxTicksLimit: 6,
                    },
                    border: { display: false },
                },
            },
        },
    });
}

function updateCharts(results) {
    // --- Pot Growth Chart ---
    var potLabels = [];
    var potData = [];
    for (var i = 0; i < results.potHistory.length; i++) {
        potLabels.push(results.potHistory[i].age);
        potData.push(Math.round(results.potHistory[i].value));
    }

    potChart.data.labels = potLabels;
    potChart.data.datasets[0].data = potData;

    // Recreate gradient in case of resize
    var potCtx = document.getElementById('potChart').getContext('2d');
    var gradient = potCtx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(33, 143, 183, 0.25)');
    gradient.addColorStop(1, 'rgba(33, 143, 183, 0.01)');
    potChart.data.datasets[0].backgroundColor = gradient;

    potChart.update('none');

    // --- Income Breakdown Chart ---
    var incLabels = [];
    var stateData = [];
    var dbData = [];
    var personalData = [];

    for (var j = 0; j < results.incomeByYear.length; j++) {
        var y = results.incomeByYear[j];
        incLabels.push(y.age);
        stateData.push(Math.round(y.state));
        dbData.push(Math.round(y.db));
        personalData.push(Math.round(y.personal));
    }

    incomeChart.data.labels = incLabels;
    incomeChart.data.datasets[0].data = stateData;    // State pension (bottom)
    incomeChart.data.datasets[1].data = dbData;        // DB (middle)
    incomeChart.data.datasets[2].data = personalData;  // Personal (top)

    incomeChart.update('none');
}

// ============================================
// Number Animation
// ============================================
var animationFrame = null;
var currentDisplayValue = 0;

function animateValue(elementId, targetValue) {
    var el = document.getElementById(elementId);
    targetValue = Math.round(targetValue);

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    var startValue = currentDisplayValue;
    var diff = targetValue - startValue;
    var duration = 400;
    var startTime = performance.now();

    function tick(now) {
        var elapsed = now - startTime;
        var progress = Math.min(elapsed / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var current = Math.round(startValue + diff * eased);
        el.textContent = current.toLocaleString('en-GB');
        currentDisplayValue = current;

        if (progress < 1) {
            animationFrame = requestAnimationFrame(tick);
        } else {
            currentDisplayValue = targetValue;
            el.textContent = targetValue.toLocaleString('en-GB');
        }
    }

    animationFrame = requestAnimationFrame(tick);
}

// ============================================
// Utility Functions
// ============================================
function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return '\u00a30';
    return '\u00a3' + Math.round(value).toLocaleString('en-GB');
}

function formatNumber(value) {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return Math.round(value).toLocaleString('en-GB');
}

function parseCurrency(str) {
    if (typeof str !== 'string') str = String(str || '');
    return parseFloat(str.replace(/[^0-9.\-]/g, '')) || 0;
}

function formatAxisValue(value) {
    if (value >= 1000000) return '\u00a3' + (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return '\u00a3' + Math.round(value / 1000) + 'K';
    return '\u00a3' + value;
}

// Make remove functions globally accessible (used by onclick in dynamic HTML)
window.removePensionPot = removePensionPot;
window.removeDBPension = removeDBPension;
