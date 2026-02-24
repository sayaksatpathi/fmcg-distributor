/**
 * Dashboard Charts JavaScript
 * Visual graphs and charts for business analytics
 * Uses Chart.js library
 */

// Chart color palette
const CHART_COLORS = {
  primary: 'rgba(54, 162, 235, 1)',
  primaryLight: 'rgba(54, 162, 235, 0.2)',
  success: 'rgba(75, 192, 92, 1)',
  successLight: 'rgba(75, 192, 92, 0.2)',
  warning: 'rgba(255, 193, 7, 1)',
  warningLight: 'rgba(255, 193, 7, 0.2)',
  danger: 'rgba(255, 99, 132, 1)',
  dangerLight: 'rgba(255, 99, 132, 0.2)',
  info: 'rgba(23, 162, 184, 1)',
  infoLight: 'rgba(23, 162, 184, 0.2)',
  purple: 'rgba(153, 102, 255, 1)',
  purpleLight: 'rgba(153, 102, 255, 0.2)',
  orange: 'rgba(255, 159, 64, 1)',
  orangeLight: 'rgba(255, 159, 64, 0.2)',
  gray: 'rgba(128, 128, 128, 1)',
  grayLight: 'rgba(128, 128, 128, 0.2)'
};

// Default chart options
const DEFAULT_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        usePointStyle: true,
        padding: 15
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { size: 14 },
      bodyFont: { size: 13 },
      padding: 12,
      cornerRadius: 6
    }
  }
};

// Chart instances storage
const chartInstances = {};

/**
 * Create Sales Trend Chart
 * Line chart showing daily/weekly/monthly sales
 */
async function createSalesTrendChart(canvasId, period = 'daily', days = 30) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch(`/api/reports/sales?period=${period}&days=${days}`);
    const data = await response.json();

    // Destroy existing chart
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => formatDate(d.date || d.period)),
        datasets: [
          {
            label: 'Revenue (₹)',
            data: data.map(d => d.revenue || d.total_revenue),
            borderColor: CHART_COLORS.primary,
            backgroundColor: CHART_COLORS.primaryLight,
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          },
          {
            label: 'Profit (₹)',
            data: data.map(d => d.profit || d.total_profit),
            borderColor: CHART_COLORS.success,
            backgroundColor: CHART_COLORS.successLight,
            fill: true,
            tension: 0.3,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        ...DEFAULT_OPTIONS,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => '₹' + formatNumber(value)
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create sales trend chart:', error);
  }
}

/**
 * Create Brand Performance Chart
 * Bar chart comparing brand sales
 */
async function createBrandPerformanceChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch('/api/reports/sales?groupBy=brand');
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.brand_name),
        datasets: [
          {
            label: 'Revenue',
            data: data.map(d => d.revenue),
            backgroundColor: CHART_COLORS.primary,
            borderColor: CHART_COLORS.primary,
            borderWidth: 1
          },
          {
            label: 'Profit',
            data: data.map(d => d.profit),
            backgroundColor: CHART_COLORS.success,
            borderColor: CHART_COLORS.success,
            borderWidth: 1
          }
        ]
      },
      options: {
        ...DEFAULT_OPTIONS,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => '₹' + formatNumber(value)
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create brand performance chart:', error);
  }
}

/**
 * Create Top SKUs Chart
 * Horizontal bar chart for top selling products
 */
async function createTopSKUsChart(canvasId, limit = 10) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch(`/api/reports/sales?groupBy=sku&limit=${limit}`);
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => truncateText(d.sku_name, 20)),
        datasets: [{
          label: 'Units Sold',
          data: data.map(d => d.quantity),
          backgroundColor: generateGradientColors(data.length),
          borderWidth: 0
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create top SKUs chart:', error);
  }
}

/**
 * Create Inventory Status Chart
 * Doughnut chart showing stock status distribution
 */
async function createInventoryStatusChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch('/api/inventory-alerts/summary');
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Out of Stock', 'Critical', 'Low Stock', 'Normal'],
        datasets: [{
          data: [
            data.outOfStock || 0,
            data.criticalStock || 0,
            data.lowStock || 0,
            data.total - (data.outOfStock + data.criticalStock + data.lowStock) || 0
          ],
          backgroundColor: [
            CHART_COLORS.danger,
            CHART_COLORS.orange,
            CHART_COLORS.warning,
            CHART_COLORS.success
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        cutout: '60%',
        plugins: {
          ...DEFAULT_OPTIONS.plugins,
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create inventory status chart:', error);
  }
}

/**
 * Create Credit Overview Chart
 * Pie chart showing credit distribution
 */
async function createCreditOverviewChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch('/api/reports/credit');
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Exceeded Limit', 'High Usage', 'Medium Usage', 'Low Usage'],
        datasets: [{
          data: [
            data.exceededLimit || 0,
            data.highUsage || 0,
            data.mediumUsage || 0,
            data.lowUsage || 0
          ],
          backgroundColor: [
            CHART_COLORS.danger,
            CHART_COLORS.warning,
            CHART_COLORS.info,
            CHART_COLORS.success
          ]
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        plugins: {
          ...DEFAULT_OPTIONS.plugins,
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create credit overview chart:', error);
  }
}

/**
 * Create Sales Target Progress Chart
 * Gauge-style chart for target achievement
 */
async function createTargetProgressChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch('/api/sales-targets/summary');
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const achieved = data.totalAchieved || 0;
    const target = data.totalTarget || 1;
    const percentage = Math.min((achieved / target) * 100, 100);

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Achieved', 'Remaining'],
        datasets: [{
          data: [percentage, 100 - percentage],
          backgroundColor: [
            percentage >= 100 ? CHART_COLORS.success : 
            percentage >= 70 ? CHART_COLORS.primary : 
            percentage >= 50 ? CHART_COLORS.warning : CHART_COLORS.danger,
            CHART_COLORS.grayLight
          ],
          borderWidth: 0
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        cutout: '75%',
        rotation: -90,
        circumference: 180,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.dataIndex === 0) {
                  return `Achieved: ₹${formatNumber(achieved)} (${percentage.toFixed(1)}%)`;
                }
                return `Remaining: ₹${formatNumber(target - achieved)}`;
              }
            }
          }
        }
      },
      plugins: [{
        id: 'centerText',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const centerX = chart.width / 2;
          const centerY = chart.height - 30;
          
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = 'bold 24px Arial';
          ctx.fillStyle = '#333';
          ctx.fillText(`${percentage.toFixed(0)}%`, centerX, centerY);
          ctx.font = '12px Arial';
          ctx.fillStyle = '#666';
          ctx.fillText('Target Achievement', centerX, centerY + 20);
          ctx.restore();
        }
      }]
    });
  } catch (error) {
    console.error('Failed to create target progress chart:', error);
  }
}

/**
 * Create Payment Collection Trend Chart
 */
async function createPaymentTrendChart(canvasId, days = 30) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch(`/api/credit-control/collections?days=${days}`);
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => formatDate(d.date)),
        datasets: [{
          label: 'Collections (₹)',
          data: data.map(d => d.amount),
          backgroundColor: CHART_COLORS.success,
          borderRadius: 4
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => '₹' + formatNumber(value)
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create payment trend chart:', error);
  }
}

/**
 * Create Retailer Distribution Map (Top Retailers)
 */
async function createRetailerDistributionChart(canvasId, limit = 8) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch(`/api/reports/retailer/top?limit=${limit}`);
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: data.map(d => truncateText(d.name, 15)),
        datasets: [{
          data: data.map(d => d.total_sales),
          backgroundColor: generateGradientColors(data.length, 0.7)
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        scales: {
          r: {
            display: false
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create retailer distribution chart:', error);
  }
}

/**
 * Create Returns Analysis Chart
 */
async function createReturnsChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  try {
    const response = await fetch('/api/returns/stats');
    const data = await response.json();

    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
    }

    const byType = data.byType || [];

    const ctx = canvas.getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: byType.map(d => formatReturnType(d.return_type)),
        datasets: [{
          label: 'Count',
          data: byType.map(d => d.count),
          backgroundColor: CHART_COLORS.danger,
          yAxisID: 'y'
        }, {
          label: 'Value (₹)',
          data: byType.map(d => d.value),
          backgroundColor: CHART_COLORS.warning,
          yAxisID: 'y1'
        }]
      },
      options: {
        ...DEFAULT_OPTIONS,
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: {
              callback: value => '₹' + formatNumber(value)
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to create returns chart:', error);
  }
}

// ============ Utility Functions ============

function formatNumber(num) {
  if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr';
  if (num >= 100000) return (num / 100000).toFixed(2) + 'L';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toFixed(0);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function formatReturnType(type) {
  if (!type) return '';
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function generateGradientColors(count, alpha = 1) {
  const baseColors = [
    [54, 162, 235],   // Blue
    [75, 192, 92],    // Green
    [255, 193, 7],    // Yellow
    [255, 99, 132],   // Red
    [153, 102, 255],  // Purple
    [255, 159, 64],   // Orange
    [23, 162, 184],   // Cyan
    [108, 117, 125],  // Gray
  ];

  const colors = [];
  for (let i = 0; i < count; i++) {
    const color = baseColors[i % baseColors.length];
    colors.push(`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`);
  }
  return colors;
}

// ============ Dashboard Initialization ============

function initDashboardCharts() {
  // Initialize all charts on dashboard load
  createSalesTrendChart('salesTrendChart', 'daily', 30);
  createBrandPerformanceChart('brandChart');
  createTopSKUsChart('topSkusChart', 10);
  createInventoryStatusChart('inventoryChart');
  createCreditOverviewChart('creditChart');
  createTargetProgressChart('targetChart');
}

// Refresh all charts
function refreshAllCharts() {
  Object.keys(chartInstances).forEach(key => {
    if (chartInstances[key]) {
      chartInstances[key].destroy();
    }
  });
  initDashboardCharts();
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    createSalesTrendChart,
    createBrandPerformanceChart,
    createTopSKUsChart,
    createInventoryStatusChart,
    createCreditOverviewChart,
    createTargetProgressChart,
    createPaymentTrendChart,
    createRetailerDistributionChart,
    createReturnsChart,
    initDashboardCharts,
    refreshAllCharts,
    CHART_COLORS
  };
}
