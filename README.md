# Employee Timesheet Management System

A modern web application for managing employee schedules and timesheets with secure login and admin functionality.

## Features

### Employee Features
- **Secure Login**: Employees can log in with their credentials
- **Personal Timesheet View**: View their own schedule organized by work site
- **Clean Interface**: Easy-to-read schedule display with days, times, and locations

### Admin Features
- **Admin Dashboard**: Upload and manage employee schedules
- **Excel/CSV Upload**: Drag and drop or browse to upload schedule files
- **Template Download**: Download a template Excel file for proper formatting
- **Employee Overview**: View all employees and their schedule status

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No server setup required - runs entirely in the browser

### Installation
1. Download all files to a folder on your computer
2. Open `index.html` in your web browser
3. The application will load and be ready to use

## Usage

### For Employees
1. **Login**: Use your assigned username and password
2. **Select Role**: Choose "Employee" from the role dropdown
3. **View Schedule**: See your weekly schedule organized by work site
4. **Logout**: Click the logout button when done

### For Admins
1. **Login**: Use admin credentials (username: `admin`, password: `admin123`)
2. **Select Role**: Choose "Admin" from the role dropdown
3. **Upload Schedule**: 
   - Download the template to see the required format
   - Fill in employee schedules
   - Drag and drop or browse to upload the file
   - Click "Upload Schedule" to process
4. **View Employees**: See all employees and their schedule status

## Sample Login Credentials

### Employee
- **Username**: `test` | **Password**: `test`

### Admin
- **Username**: `admin` | **Password**: `admin`

## Excel File Format

The system expects Excel files with the following columns:
- **Employee**: Employee name (e.g., "John Doe")
- **Site**: Work site name (e.g., "Site 1")
- **Day**: Day of the week (e.g., "Monday")
- **StartTime**: Start time (e.g., "3:00 PM")
- **EndTime**: End time (e.g., "12:00 AM")

### Example Data
| Employee | Site | Day | StartTime | EndTime |
|----------|------|-----|-----------|---------|
| John Doe | Site 1 | Monday | 3:00 PM | 12:00 AM |
| John Doe | Site 1 | Wednesday | 3:00 PM | 12:00 AM |
| Jane Smith | Site 2 | Tuesday | 9:00 AM | 5:00 PM |

## File Support
- **Excel Files**: .xlsx, .xls
- **CSV Files**: .csv

## Security Features
- Role-based access control
- Secure login system
- Employee data isolation (employees only see their own schedule)
- Admin-only file upload functionality

## Customization

### Adding New Employees
1. Edit the `loadSampleData()` function in `script.js`
2. Add new employee entries to the `employees` Map
3. Add corresponding schedule entries to the `schedules` Map

### Styling
- Modify `styles.css` to change colors, fonts, and layout
- The design is fully responsive and mobile-friendly

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Troubleshooting

### File Upload Issues
- Ensure your Excel file follows the required format
- Check that all required columns are present
- Try downloading and using the template first

### Login Issues
- Verify you're using the correct username and password
- Make sure you've selected the correct role (Employee or Admin)
- Check the browser console for any error messages

## Future Enhancements
- Database integration for persistent storage
- Email notifications for schedule changes
- Mobile app version
- Time tracking and clock in/out functionality
- Reporting and analytics features

## Support
For technical support or questions about the system, please contact your system administrator.
# ProjectforGameWorld
