const pool = require('./db');
const cron = require('node-cron');
const axios = require('axios');

// Dummy API endpoint for posting responses
const DUMMY_API_URL = 'https://jsonplaceholder.typicode.com/posts';

// Sample data for generating random resolution content
const resolutionCategories = [
    'Technical Issue', 'Billing Dispute', 'Service Request', 'Infrastructure Problem',
    'Meter Reading Error', 'Power Quality Issue', 'Connection Problem', 'Documentation Issue'
];

const resolvedByNames = [
    'John Smith', 'Sarah Johnson', 'Mike Wilson', 'Emily Davis', 'Robert Brown',
    'Lisa Anderson', 'David Miller', 'Jennifer Taylor', 'Michael Garcia', 'Amanda White'
];

const approvedByNames = [
    'Manager Kumar', 'Supervisor Singh', 'Team Lead Sharma', 'Director Patel',
    'Senior Manager Gupta', 'Operations Head Verma', 'Technical Lead Agarwal'
];

// Function to generate resolution content based on complaint description
function generateResolutionContent(complaintDescription, complaintType) {
    const category = resolutionCategories[Math.floor(Math.random() * resolutionCategories.length)];
    const resolvedBy = resolvedByNames[Math.floor(Math.random() * resolvedByNames.length)];
    const approvedBy = approvedByNames[Math.floor(Math.random() * approvedByNames.length)];

    // Generate resolution summary based on complaint type and description
    let resolutionSummary = '';
    let detailedResolution = '';
    let actionTaken = '';
    let rootCause = '';
    let preventiveMeasures = '';

    if (complaintType === 'billing') {
        resolutionSummary = 'Billing discrepancy resolved after meter reading verification and tariff calculation review.';
        detailedResolution = 'Upon investigation, the billing issue was identified as a meter reading error. The actual consumption was recalculated based on corrected meter readings, and the bill was adjusted accordingly. Customer was informed of the resolution and provided with the corrected bill statement.';
        actionTaken = 'Meter reading verification, bill recalculation, and customer notification completed.';
        rootCause = 'Incorrect meter reading due to manual data entry error.';
        preventiveMeasures = 'Implemented double verification process for meter readings and automated validation checks.';
    } else if (complaintType === 'meter') {
        resolutionSummary = 'Meter malfunction addressed through technical inspection and replacement/repair.';
        detailedResolution = 'Technical team conducted on-site inspection and identified meter calibration issues. The meter was either recalibrated or replaced based on the severity of the problem. New readings were established and customer was notified of the resolution.';
        actionTaken = 'On-site meter inspection, calibration/replacement, and system update completed.';
        rootCause = 'Meter component degradation due to environmental factors and age.';
        preventiveMeasures = 'Scheduled preventive maintenance program for meters and regular calibration checks.';
    } else if (complaintType === 'supply') {
        resolutionSummary = 'Power supply issue resolved through infrastructure repair and system optimization.';
        detailedResolution = 'Field team identified the root cause of power interruption and performed necessary repairs to the distribution network. Load balancing was optimized and backup systems were tested to ensure stable power supply.';
        actionTaken = 'Infrastructure repair, load balancing optimization, and system testing completed.';
        rootCause = 'Equipment failure in distribution transformer due to overloading.';
        preventiveMeasures = 'Regular transformer maintenance schedule and load monitoring system implementation.';
    } else if (complaintType === 'service') {
        resolutionSummary = 'Service request fulfilled through proper resource allocation and process execution.';
        detailedResolution = 'Customer service request was processed according to standard operating procedures. Required documentation was verified, technical assessment was completed, and service was provided as per customer requirements.';
        actionTaken = 'Documentation verification, technical assessment, and service delivery completed.';
        rootCause = 'Standard service request requiring normal processing workflow.';
        preventiveMeasures = 'Streamlined service request process and improved customer communication protocols.';
    } else {
        resolutionSummary = 'Customer concern addressed through detailed investigation and appropriate corrective measures.';
        detailedResolution = 'Comprehensive investigation was conducted to understand the customer concern. Appropriate corrective measures were implemented based on findings, and customer was kept informed throughout the resolution process.';
        actionTaken = 'Detailed investigation, corrective measures implementation, and customer communication completed.';
        rootCause = 'Process gap identified in standard operating procedures.';
        preventiveMeasures = 'Process improvement initiatives and staff training programs implemented.';
    }

    return {
        resolution_category: category,
        resolution_summary: resolutionSummary,
        detailed_resolution: detailedResolution,
        action_taken: actionTaken,
        root_cause: rootCause,
        preventive_measures: preventiveMeasures,
        resolved_by: resolvedBy,
        approved_by: approvedBy
    };
}

// Function to post response to dummy API
async function postResponseToDummyAPI(processedComplaints, totalProcessed) {
    const responseData = {
        title: 'Complaint Resolution Scheduler Report',
        body: {
            timestamp: new Date().toISOString(),
            total_complaints_processed: totalProcessed,
            status: 'completed',
            processed_complaints: processedComplaints.map(complaint => ({
                complaint_number: complaint.complaint_number,
                consumer_number: complaint.consumer_number,
                complaint_type: complaint.complaint_type,
                resolution_id: complaint.resolution_id,
                status: 'resolved',
                resolution_category: complaint.resolution_details.resolution_category,
                resolution_summary: complaint.resolution_details.resolution_summary,
                detailed_resolution: complaint.resolution_details.detailed_resolution,
                action_taken: complaint.resolution_details.action_taken,
                root_cause: complaint.resolution_details.root_cause,
                preventive_measures: complaint.resolution_details.preventive_measures
            }))
        },
        userId: 1
    };

    try {
        const response = await axios.post(DUMMY_API_URL, responseData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Successfully posted response to dummy API:', response.status);
        console.log('API Response ID:', response.data.id);
        return response.data;
    } catch (error) {
        console.error('Error posting to dummy API:', error.message);
        return null;
    }
}

// Function to process pending complaints and create resolutions
async function processComplaintsAndCreateResolutions() {
    try {
        console.log('Starting complaint resolution scheduler...');

        // Fetch complaints that are pending and created at least 1 hour ago
        const oneHourAgo = new Date();
        oneHourAgo.setHours(oneHourAgo.getHours() - 1);

        const pendingComplaints = await pool.query(
            `SELECT complaint_number, consumer_number, subject, description, complaint_type, created_on
             FROM cis.complaints 
             WHERE status IN ('open', 'acknowledged', 'in_progress') 
             AND resolution_id IS NULL
             AND created_on <= $1`,
            [oneHourAgo]
        );

        console.log(`Found ${pendingComplaints.rows.length} complaints to process`);

        const processedComplaints = [];

        for (const complaint of pendingComplaints.rows) {
            try {
                // Generate resolution content
                const resolutionContent = generateResolutionContent(
                    complaint.description,
                    complaint.complaint_type
                );

                // Insert resolution into cis.resolutions table
                const resolutionResult = await pool.query(
                    `INSERT INTO cis.resolutions 
                     (ticket_type, resolution_type, resolution_category, resolution_summary, 
                      detailed_resolution, action_taken, root_cause, preventive_measures, 
                      resolved_by, approved_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     RETURNING resolution_id`,
                    [
                        'complaint',
                        'resolved',
                        resolutionContent.resolution_category,
                        resolutionContent.resolution_summary,
                        resolutionContent.detailed_resolution,
                        resolutionContent.action_taken,
                        resolutionContent.root_cause,
                        resolutionContent.preventive_measures,
                        resolutionContent.resolved_by,
                        resolutionContent.approved_by
                    ]
                );

                const resolutionId = resolutionResult.rows[0].resolution_id;

                // Update complaint with resolution_id and status
                await pool.query(
                    `UPDATE cis.complaints 
                     SET resolution_id = $1, status = 'resolved', modified_on = CURRENT_TIMESTAMP
                     WHERE complaint_number = $2`,
                    [resolutionId, complaint.complaint_number]
                );

                console.log(`Created resolution ${resolutionId} for complaint ${complaint.complaint_number}`);

                // Add to processed complaints list
                processedComplaints.push({
                    complaint_number: complaint.complaint_number,
                    consumer_number: complaint.consumer_number,
                    complaint_type: complaint.complaint_type,
                    resolution_id: resolutionId,
                    resolution_category: resolutionContent.resolution_category,
                    resolution_summary: resolutionContent.resolution_summary,
                    detailed_resolution: resolutionContent.detailed_resolution,
                    action_taken: resolutionContent.action_taken,
                    root_cause: resolutionContent.root_cause,
                    preventive_measures: resolutionContent.preventive_measures
                });

            } catch (error) {
                console.error(`Error processing complaint ${complaint.complaint_number}:`, error);
            }
        }

        console.log('Complaint resolution scheduler completed successfully');

        // Post response to dummy API
        if (processedComplaints.length > 0) {
            console.log('Posting response to dummy API...');
            await postResponseToDummyAPI(processedComplaints, processedComplaints.length);
        } else {
            console.log('No complaints processed, skipping API post');
        }

    } catch (error) {
        console.error('Error in complaint resolution scheduler:', error);
    }
}

// Schedule the job to run every hour
const startScheduler = () => {
    // Run every hour at minute 0
    cron.schedule('33 8 * * *', () => {
        console.log('Running scheduled complaint resolution job...');
        processComplaintsAndCreateResolutions();
    });

    console.log('Complaint resolution scheduler started - runs every hour');

    // Optional: Run immediately for testing
    // processComplaintsAndCreateResolutions();
};

// Manual trigger function for testing
const runSchedulerNow = () => {
    console.log('Manually triggering complaint resolution scheduler...');
    processComplaintsAndCreateResolutions();
};

module.exports = {
    startScheduler,
    runSchedulerNow,
    processComplaintsAndCreateResolutions
};
