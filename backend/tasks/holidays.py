from datetime import datetime, date, timedelta  

def get_indian_holidays(year):
    """
    Returns list of Indian national holidays for a given year
    Includes major national holidays and festivals
    """
    holidays = [
        {'date': date(year, 1, 26), 'name': 'Republic Day'},
        {'date': date(year, 8, 15), 'name': 'Independence Day'},
        {'date': date(year, 10, 2), 'name': 'Gandhi Jayanti'},
        {'date': date(year, 12, 25), 'name': 'Christmas'},
        
        {'date': date(year, 3, 8), 'name': 'Maha Shivaratri'},
        {'date': date(year, 3, 25), 'name': 'Holi'},
        {'date': date(year, 3, 29), 'name': 'Good Friday'},
        {'date': date(year, 4, 17), 'name': 'Ram Navami'},
        {'date': date(year, 4, 21), 'name': 'Mahavir Jayanti'},
        {'date': date(year, 5, 1), 'name': 'May Day'},
        {'date': date(year, 5, 23), 'name': 'Buddha Purnima'},
        {'date': date(year, 6, 28), 'name': 'Eid ul-Fitr'},
        {'date': date(year, 7, 17), 'name': 'Muharram'},
        {'date': date(year, 9, 16), 'name': 'Milad un-Nabi'},
        {'date': date(year, 10, 12), 'name': 'Dussehra'},
        {'date': date(year, 10, 20), 'name': 'Diwali'},
        {'date': date(year, 10, 21), 'name': 'Diwali (Day 2)'},
        {'date': date(year, 11, 15), 'name': 'Guru Nanak Jayanti'},
    ]
    return holidays

def is_indian_holiday(check_date):
    """
    Check if a given date is an Indian holiday
    Returns: {'is_holiday': bool, 'name': str or None}
    """
    if isinstance(check_date, str):
        check_date = datetime.strptime(check_date, '%Y-%m-%d').date()
    elif isinstance(check_date, datetime):
        check_date = check_date.date()
    
    holidays = get_indian_holidays(check_date.year)
    
    for holiday in holidays:
        if holiday['date'] == check_date:
            return {'is_holiday': True, 'name': holiday['name']}
    
    return {'is_holiday': False, 'name': None}

def is_weekend(check_date):
    """
    Check if a given date is a weekend (Saturday or Sunday)
    Returns: bool
    """
    if isinstance(check_date, str):
        check_date = datetime.strptime(check_date, '%Y-%m-%d').date()
    elif isinstance(check_date, datetime):
        check_date = check_date.date()

    return check_date.weekday() in [5, 6]

def calculate_business_days(from_date, to_date):
    """
    Calculate business days between two dates (excluding weekends and Indian holidays)
    Returns: int
    """
    if isinstance(from_date, str):
        from_date = datetime.strptime(from_date, '%Y-%m-%d').date()
    elif isinstance(from_date, datetime):
        from_date = from_date.date()
    
    if isinstance(to_date, str):
        to_date = datetime.strptime(to_date, '%Y-%m-%d').date()
    elif isinstance(to_date, datetime):
        to_date = to_date.date()
    
    business_days = 0
    current_date = from_date
    
    while current_date < to_date:
    
        if not is_weekend(current_date) and not is_indian_holiday(current_date)['is_holiday']:
            business_days += 1
        current_date = current_date + timedelta(days=1) 
    return business_days

def get_urgency_label(days_until_due):
    """
    Get urgency label based on days until due date
    """
    if days_until_due < 0:
        return '🚨 OVERDUE'
    elif days_until_due == 0:
        return '⏰ DUE TODAY'
    elif days_until_due == 1:
        return '📍 DUE TOMORROW'
    elif days_until_due <= 3:
        return '⚡ DUE SOON'
    elif days_until_due <= 7:
        return '📅 DUE THIS WEEK'
    else:
        return '📆 DUE LATER'