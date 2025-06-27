/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/auth.html';
}

const fetchJobs = async () => {
  try {
    const response = await fetch('/api/jobs', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!response.ok) throw new Error('Failed to fetch jobs');
    const jobs = await response.json();
    document.getElementById('total-jobs').innerHTML = jobs.length;
    document.getElementById('active-jobs').innerHTML = jobs.filter(j => j.status === 'active').length;
    document.getElementById('completed-jobs').innerHTML = jobs.filter(j => j.status === 'completed').length;
    document.getElementById('failed-jobs').innerHTML = jobs.filter(j => j.status === 'failed').length;

    const tbody = document.getElementById('jobs-table-body');
    tbody.innerHTML = '';
    jobs.forEach(job => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${job._id}</td>
        <td>${job.name}</td>
        <td>${job.status}</td>
        <td>${new Date(job.createdAt).toLocaleString()}</td>
        <td>
          ${job.status === 'failed' ? `<button onclick="retryJob('${job._id}')">Retry</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
  }
};

const retryJob = async (jobId) => {
  try {
    const response = await fetch(`/api/jobs/${jobId}/retry`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!response.ok) throw new Error('Failed to retry job');
    fetchJobs();
  } catch (error) {
    console.error('Error retrying job:', error);
  }
};

fetchJobs();
setInterval(fetchJobs, 5000); // Auto-refresh every 5 seconds
