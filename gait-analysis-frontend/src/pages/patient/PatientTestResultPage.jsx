import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Grid,
  Divider,
  Button,
  Alert,
  Snackbar,
  Container,
  Card,
  CardContent,
  Chip,
  IconButton,
} from "@mui/material";
import axios from "../../services/axiosInstance";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

// Icons
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import DirectionsWalkIcon from "@mui/icons-material/DirectionsWalk";
import BalanceIcon from "@mui/icons-material/Balance";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";
import FolderIcon from "@mui/icons-material/Folder";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingIcon from "@mui/icons-material/Pending";
import TimelineIcon from "@mui/icons-material/Timeline";
import SpeedIcon from "@mui/icons-material/Speed";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function PatientTestResultPage() {
  const { id } = useParams();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await axios.get(`/api/test-sessions/${id}`);
        setSession(res.data);
      } catch (err) {
        console.error("Failed to load test session", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [id]);

  const handleDownload = async () => {
  if (!session?.sessionId) {
    setNotification({
      open: true,
      message: "No session ID available",
      severity: "error"
    });
    return;
  }

  setDownloading(true);
  
  try {
    // Primary: Try Spring Boot proxy download
    await attemptSpringBootDownload();
    
  } catch (error) {
    console.error("Primary download failed:", error);
    
    if (error.response?.status === 404) {
      setNotification({
        open: true,
        message: "Report not found for this session",
        severity: "error"
      });
    } else if (error.response?.status === 500 || error.code === 'ECONNABORTED') {
      // Server error or timeout - try refresh and retry Spring Boot proxy
      setNotification({
        open: true,
        message: "Server error or timeout. Please try again later",
        severity: "error"
      });
    } else {
      setNotification({
        open: true,
        message: "Failed to download report. Please try again.",
        severity: "error"
      });
    }
  } finally {
    setDownloading(false);
  }
};

const attemptSpringBootDownload = async () => {
  const response = await axios.get(`/api/sessions/${session.sessionId}/download-report`, {
    responseType: 'blob',
    timeout: 30000,
  });
  
  // Create blob and trigger download
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Extract filename from Content-Disposition header
  let filename = `Gait_Analysis_Report_Session_${session.sessionId}.pdf`;
  
  const contentDisposition = response.headers['content-disposition'];
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  }
  
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  
  setNotification({
    open: true,
    message: "Report downloaded successfully!",
    severity: "success"
  });
};



  const handleViewReport = async () => {
    if (!session?.results?.pressureResultsPath) {
      setNotification({
        open: true,
        message: "No report available to view",
        severity: "error"
      });
      return;
    }

    try {
      let viewUrl = session.results.pressureResultsPath;
      
      // Check if URL is expired
      const testResponse = await fetch(viewUrl, { method: 'HEAD' });
      
      if (!testResponse.ok && testResponse.status === 403) {
        // Try to get fresh URL
        try {
          const refreshResponse = await axios.get(`/api/sessions/${session.sessionId}/report-url`);
          if (refreshResponse.data.success) {
            viewUrl = refreshResponse.data.reportUrl;
          }
        } catch (refreshError) {
          console.warn("Could not refresh URL:", refreshError);
        }
      }
      
      window.open(viewUrl, '_blank');
      
    } catch (error) {
      setNotification({
        open: true,
        message: "Failed to open report. The link may have expired.",
        severity: "error"
      });
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const getStatusChip = (status) => {
    const statusConfig = {
      'COMPLETED': { color: '#48bb78', bgcolor: 'rgba(72, 187, 120, 0.1)', icon: <CheckCircleIcon sx={{ fontSize: 16 }} /> },
      'PENDING': { color: '#ed8936', bgcolor: 'rgba(237, 137, 54, 0.1)', icon: <PendingIcon sx={{ fontSize: 16 }} /> },
      'FAILED': { color: '#f56565', bgcolor: 'rgba(245, 101, 101, 0.1)', icon: <PendingIcon sx={{ fontSize: 16 }} /> },
    };
    
    const config = statusConfig[status] || statusConfig['PENDING'];
    
    return (
      <Chip
        icon={config.icon}
        label={status}
        sx={{
          color: config.color,
          backgroundColor: config.bgcolor,
          fontWeight: 600,
          border: `1px solid ${config.color}30`,
        }}
      />
    );
  };

  const MetricCard = ({ icon, title, value, unit, color = "#4299e1" }) => (
    <Card
      elevation={3}
      sx={{
        height: "100%",
        borderRadius: 3,
        background: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              backgroundColor: `${color}20`,
              color: color,
              mr: 2,
            }}
          >
            {icon}
          </Box>
          <Typography variant="subtitle1" fontWeight="600" color="text.primary">
            {title}
          </Typography>
        </Box>
        <Typography
          variant="h4"
          fontWeight="700"
          color="text.primary"
          sx={{ lineHeight: 1.2 }}
        >
          {value}
          {unit && (
            <Typography
              component="span"
              variant="h6"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              {unit}
            </Typography>
          )}
        </Typography>
      </CardContent>
    </Card>
  );
  

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
        sx={{ bgcolor: "#f8fafc" }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress size={48} thickness={4} />
          <Typography variant="h6" sx={{ mt: 2, color: "text.secondary" }}>
            Loading test session...
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <Typography variant="h5" color="text.secondary">
            Test session not found.
          </Typography>
        </Paper>
      </Container>
    );
  }

  const { results, feedback, rawSensorData } = session;
  const { avgForce, strideTimes = [] } = results;

  const chartData = {
    labels: strideTimes.map((_, index) => `Stride ${index + 1}`),
    datasets: [
      {
        label: "Stride Times (s)",
        data: strideTimes,
        borderColor: "#4299e1",
        backgroundColor: "rgba(66, 153, 225, 0.1)",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#4299e1",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#ffffff",
        bodyColor: "#ffffff",
        borderColor: "#4299e1",
        borderWidth: 1,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
    },
  };

  return (
    <Box sx={{ bgcolor: "#f8fafc", minHeight: "100vh", py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                background: "linear-gradient(135deg, #4299e1 0%, #3182ce 100%)",
                color: "white",
              }}
            >
              <ShowChartIcon sx={{ fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="700" color="text.primary">
                Test Session #{session.sessionId}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
                {getStatusChip(session.status)}
                <Typography variant="body1" color="text.secondary">
                  Duration: {results.durationSeconds}s
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Key Metrics */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<DirectionsWalkIcon />}
              title="Steps"
              value={results.steps}
              color="#48bb78"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<SpeedIcon />}
              title="Cadence"
              value={results.cadence}
              unit="steps/min"
              color="#4299e1"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<BalanceIcon />}
              title="Balance Score"
              value={results.balanceScore}
              color="#9f7aea"
            />
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              icon={<TimelineIcon />}
              title="Peak Impact"
              value={results.peakImpact}
              color="#ed8936"
            />
          </Grid>

          {/* Session Details */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <AccessTimeIcon sx={{ color: "#4299e1" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Session Details
                  </Typography>
                </Box>
                
                <Grid container spacing={3}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Start Time
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {new Date(session.startTime).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(session.startTime).toLocaleTimeString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      End Time
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {new Date(session.endTime).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(session.endTime).toLocaleTimeString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Swing Time
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {results.avgSwingTime}s
                    </Typography>
                  </Grid>

                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Stance Time
                    </Typography>
                    <Typography variant="body1" fontWeight="500">
                      {results.avgStanceTime}s
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Force Distribution */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "100%", background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <BalanceIcon sx={{ color: "#48bb78" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Force Distribution
                  </Typography>
                </Box>
                
                <Grid container spacing={3}>
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Heel
                      </Typography>
                      <Typography variant="h5" fontWeight="700" color="#4299e1">
                        {avgForce.heel}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Midfoot
                      </Typography>
                      <Typography variant="h5" fontWeight="700" color="#48bb78">
                        {avgForce.midfoot}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={4}>
                    <Box sx={{ textAlign: "center" }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Toe
                      </Typography>
                      <Typography variant="h5" fontWeight="700" color="#ed8936">
                        {avgForce.toe}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Charts */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: "400px", background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <ShowChartIcon sx={{ color: "#4299e1" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Stride Time Analysis
                  </Typography>
                </Box>
                {strideTimes.length > 0 ? (
                  <Box sx={{ height: "300px" }}>
                    <Line data={chartData} options={chartOptions} />
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                    <Typography color="text.secondary">No stride time data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ height: "400px", background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4, height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <TimelineIcon sx={{ color: "#ed8936" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Force Over Time
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
                  <Typography color="text.secondary">Chart coming soon</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Feedback */}
          <Grid item xs={12}>
            <Card sx={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <DescriptionIcon sx={{ color: "#9f7aea" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Clinical Feedback
                  </Typography>
                  {feedback?.createdAt && (
                    <Chip
                      label={`Updated ${new Date(feedback.createdAt).toLocaleDateString()}`}
                      size="small"
                      sx={{
                        backgroundColor: "rgba(159, 122, 234, 0.1)",
                        color: "#9f7aea",
                        fontWeight: 500,
                      }}
                    />
                  )}
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Typography 
                  variant="body1" 
                  sx={{ 
                    lineHeight: 1.7,
                    color: "text.primary",
                    fontStyle: feedback?.notes ? "normal" : "italic"
                  }}
                >
                  {feedback?.notes || "No clinical feedback provided yet."}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Files & Actions */}
          <Grid item xs={12}>
            <Card sx={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 2 }}>
              <CardContent sx={{ p: 4 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
                  <FolderIcon sx={{ color: "#48bb78" }} />
                  <Typography variant="h6" fontWeight="600" color="text.primary">
                    Reports & Files
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 3 }}>
                  <Button
                    variant="outlined"
                    startIcon={<VisibilityIcon />}
                    onClick={handleViewReport}
                    disabled={!session?.results?.pressureResultsPath}
                    sx={{
                      borderColor: "#4299e1",
                      color: "#4299e1",
                      "&:hover": {
                        borderColor: "#3182ce",
                        backgroundColor: "rgba(66, 153, 225, 0.04)",
                      },
                    }}
                  >
                    View PDF Report
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<FolderIcon />}
                    href={rawSensorData?.path}
                    target="_blank"
                    disabled={!rawSensorData?.path}
                    sx={{
                      borderColor: "#ed8936",
                      color: "#ed8936",
                      "&:hover": {
                        borderColor: "#dd6b20",
                        backgroundColor: "rgba(237, 137, 54, 0.04)",
                      },
                    }}
                  >
                    Raw Sensor Data
                  </Button>

                  <Button
                    variant="contained"
                    startIcon={downloading ? <CircularProgress size={16} /> : <DownloadIcon />}
                    onClick={handleDownload}
                    disabled={downloading || !session?.results?.pressureResultsPath}
                    sx={{
                      background: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)",
                      "&:hover": {
                        background: "linear-gradient(135deg, #38a169 0%, #2f855a 100%)",
                      },
                    }}
                  >
                    {downloading ? 'Downloading...' : 'Download Report'}
                  </Button>
                </Box>

                {/* Status indicator */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {session?.results?.pressureResultsPath ? (
                    <>
                      <CheckCircleIcon sx={{ color: "#48bb78", fontSize: 18 }} />
                      <Typography variant="body2" color="#48bb78" fontWeight="500">
                        PDF Report available
                      </Typography>
                    </>
                  ) : (
                    <>
                      <PendingIcon sx={{ color: "#ed8936", fontSize: 18 }} />
                      <Typography variant="body2" color="#ed8936" fontWeight="500">
                        PDF Report processing
                      </Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Notification Snackbar */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            sx={{ 
              width: '100%',
              borderRadius: 2,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}