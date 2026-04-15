// constants/theme.ts

export const COLORS = {
    background: '#000000',
    cardDark: '#0A0A0A',       
    primary: '#00FF66',  // Neon green - main accent
    white: '#FFFFFF',
    greyText: '#555555', 
    lightText: '#A0A0A0',
    borderColor: '#1a1a1a', 
    
    // Brutalist Status Colors
    danger: '#FF2C55',  // High Priority
    warning: '#FFB800', // Medium Priority
    success: '#00FF66', // Low Priority
    
    // Entity Type Colors (Electric Brutalist)
    entityToDo: '#00FF66',      // Neon Green
    entityDeadline: '#FF2C55',  // Neon Red
    entityMeeting: '#00E5FF',   // Cyan
    entityRest: '#B000FF',      // Purple
};

export const ENTITY_COLORS: { [key: string]: string } = {
    TO_DO: COLORS.entityToDo,
    DEADLINE: COLORS.entityDeadline,
    MEETING: COLORS.entityMeeting,
    REST: COLORS.entityRest,
};

export const BOLD_STYLES = {
    radius: {
        sm: 8,
        md: 8,
        lg: 12,
        pill: 20,
    },
    border: 2,
};