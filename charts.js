const ctx = document.getElementById('overallChart');

new Chart(ctx, {
  type: 'bar',

  data: {
    labels: ['Major', 'Minor', 'Cosmetic'],
    datasets: [
      {
        label: 'Satisfactory',
        data: [95, 97, 87],
        backgroundColor: '#d4c4a9',
        barThickness: 45
      },
      {
        label: 'Unsatisfactory',
        data: [5, 3, 13],
        backgroundColor: '#473c39',
        barThickness: 45
      }
    ]
  },

  options: {
    responsive: false,          // 🔴 REQUIRED
    maintainAspectRatio: false, // 🔴 REQUIRED
    animation: false,           // 🔴 IMPORTANT for PDF

    plugins: {
      legend: {
        position: 'top'
      }
    },

    scales: {
      x: {
        offset: true,           // 🔴 PREVENTS LAST LABEL CLIPPING
        grid: { display: false },
        ticks: {
          padding: 8
        }
      },
      y: {
        beginAtZero: true,
        max: 100,               // 🔴 FORCE FULL RANGE
        ticks: {
          stepSize: 10
        }
      }
    }
  }
});
